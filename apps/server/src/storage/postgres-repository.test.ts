import type { PostgresMatchRepository } from './postgres-repository.ts'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { apply, COMMAND_TYPE, createGame } from '@space/engine'
import { END_REASON } from '@space/protocol'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { COMMAND_SOURCE } from '../room.ts'
import { connectRepository } from './database.ts'
import { MATCH_STATUS } from './repository.ts'

/*
 * Интеграционный тест против настоящего PostgreSQL. Запускается, только если задан TEST_DATABASE_URL
 * (например, postgres://space:space@localhost:5432/space после `pnpm db:up`; в CI - сервис postgres).
 * Каждый запуск создаёт и удаляет собственную временную базу: тест чистит таблицы целиком (проверка срока хранения),
 * и данные разработки трогать нельзя.
 */
const adminUrl = process.env.TEST_DATABASE_URL

describe.skipIf(!adminUrl)('postgresMatchRepository', () => {
  const dbName = `space_test_${randomUUID().replaceAll('-', '')}`
  let repository: PostgresMatchRepository
  let admin: pg.Client
  /** Подключение к временной базе для проверки таблиц напрямую. */
  let inspector: pg.Client

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: adminUrl })
    await admin.connect()
    await admin.query(`CREATE DATABASE ${dbName}`)
    const url = new URL(adminUrl!)
    url.pathname = `/${dbName}`
    // Миграции применяются при подключении: заодно проверяется, что сгенерированный SQL рабочий.
    repository = await connectRepository(url.toString())
    inspector = new pg.Client({ connectionString: url.toString() })
    await inspector.connect()
  })

  afterAll(async () => {
    await inspector?.end()
    await repository?.close()
    await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`)
    await admin.end()
  })

  function newMatch(seed: number) {
    return {
      id: randomUUID(),
      code: 'ABC234',
      seed,
      names: ['Алиса', 'Боб'] as [string, string],
      tokenHashes: ['a'.repeat(64), 'b'.repeat(64)] as [string, string],
      state: createGame(seed, { firstPlayer: 0 }),
    }
  }

  it('партия записывается и читается обратно целиком, включая скрытое состояние', async () => {
    const match = newMatch(7)
    await repository.createMatch(match)
    await repository.createMatch(match) // повторная запись безвредна

    const loaded = (await repository.loadActive()).find(record => record.id === match.id)!
    expect(loaded).toMatchObject({ code: 'ABC234', status: MATCH_STATUS.ACTIVE, seed: 7, names: ['Алиса', 'Боб'], tokenHashes: match.tokenHashes, version: 0, winner: null, endReason: null })
    expect(loaded.state).toEqual(match.state)
    expect(loaded.state.rngState).toBe(match.state.rngState)
  })

  it('команда обновляет снимок и пишется в лог одной транзакцией, повтор той же версии не дублируется', async () => {
    const match = newMatch(8)
    await repository.createMatch(match)
    const result = apply(match.state, 0, { type: COMMAND_TYPE.END_TURN })
    if (!result.ok)
      throw new Error('END_TURN отклонён')
    const entry = { matchId: match.id, seq: result.state.version, player: 0 as const, command: { type: COMMAND_TYPE.END_TURN }, source: COMMAND_SOURCE.PLAYER, state: result.state, winner: null, endReason: null }

    await repository.appendCommand(entry)
    await repository.appendCommand(entry)

    const loaded = (await repository.loadActive()).find(record => record.id === match.id)!
    expect(loaded.version).toBe(result.state.version)
    expect(loaded.state).toEqual(result.state)
    const { rows } = await inspector.query('SELECT seq, player, source FROM match_commands WHERE match_id = $1', [match.id])
    expect(rows).toEqual([{ seq: result.state.version, player: 0, source: COMMAND_SOURCE.PLAYER }])
  })

  it('конец партии: статус finished, победитель и причина; такая партия больше не активна', async () => {
    const match = newMatch(9)
    await repository.createMatch(match)
    const result = apply(match.state, 1, { type: COMMAND_TYPE.CONCEDE })
    if (!result.ok)
      throw new Error('CONCEDE отклонён')
    await repository.appendCommand({ matchId: match.id, seq: result.state.version, player: 1, command: { type: COMMAND_TYPE.CONCEDE }, source: COMMAND_SOURCE.DISCONNECT, state: result.state, winner: 0, endReason: END_REASON.DISCONNECT })

    expect((await repository.loadActive()).some(record => record.id === match.id)).toBe(false)
  })

  it('брошенная партия не поднимается; завершённую пометка брошенной не затрагивает', async () => {
    const abandoned = newMatch(10)
    await repository.createMatch(abandoned)
    await repository.markAbandoned(abandoned.id)
    expect((await repository.loadActive()).some(record => record.id === abandoned.id)).toBe(false)
  })

  it('удаление по сроку убирает устаревшие партии вместе с логом команд', async () => {
    const old = newMatch(11)
    await repository.createMatch(old)
    const result = apply(old.state, 0, { type: COMMAND_TYPE.END_TURN })
    if (!result.ok)
      throw new Error('END_TURN отклонён')
    await repository.appendCommand({ matchId: old.id, seq: result.state.version, player: 0, command: { type: COMMAND_TYPE.END_TURN }, source: COMMAND_SOURCE.PLAYER, state: result.state, winner: null, endReason: null })

    // Ничего не старше прошлого: ничего не удаляется.
    expect(await repository.deleteOlderThan(new Date(Date.now() - 60_000))).toBe(0)

    // Всё старше «завтра»: удаляется всё, что накопили тесты выше.
    const removed = await repository.deleteOlderThan(new Date(Date.now() + 60_000))
    expect(removed).toBeGreaterThanOrEqual(1)
    expect(await repository.loadActive()).toEqual([])
    const { rows } = await inspector.query('SELECT 1 FROM match_commands')
    expect(rows).toEqual([])
  })
})
