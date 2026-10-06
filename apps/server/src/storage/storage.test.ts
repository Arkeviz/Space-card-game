import type { Binding } from '../match-manager.ts'
import { COMMAND_TYPE } from '@space/engine'
import { END_REASON, MATCH_ERROR, SERVER_MESSAGE } from '@space/protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MatchManager } from '../match-manager.ts'
import { COMMAND_SOURCE, hashToken } from '../room.ts'
import { fakeSocket } from '../testing.ts'
import { MATCH_STATUS, MemoryMatchRepository } from './repository.ts'
import { retentionCutoff, startRetention } from './retention.ts'

/** Переподключение, которое должно удаться. */
function mustReconnect(manager: MatchManager, id: string, token: string, socket = fakeSocket()): Binding {
  const result = manager.reconnect(socket, id, token)
  if ('error' in result)
    throw new Error(result.error)
  return result
}

/** Партия на двоих с хранилищем; ждёт, пока запись о создании дойдёт до него. */
async function startedMatch(repository: MemoryMatchRepository, options: ConstructorParameters<typeof MatchManager>[0] = {}) {
  const manager = new MatchManager({ firstPlayer: 0, repository, ...options })
  const socket0 = fakeSocket()
  const { room } = manager.createMatch(socket0, 'Алиса')
  const socket1 = fakeSocket()
  manager.joinMatch(socket1, room.code, 'Боб')
  await room.persisting
  return { manager, room, socket0, socket1 }
}

describe('сохранение партий', () => {
  it('партия записывается при старте: имена, хэши токенов, сид и состояние, но не открытые токены', async () => {
    const repository = new MemoryMatchRepository()
    const { room, socket0, socket1 } = await startedMatch(repository)

    const record = repository.matches.get(room.id)!
    expect(record).toMatchObject({ code: room.code, status: MATCH_STATUS.ACTIVE, names: ['Алиса', 'Боб'], seed: room.seed, version: 0, winner: null })
    expect(record.tokenHashes).toEqual([hashToken(socket0.token), hashToken(socket1.token)])
    expect(JSON.stringify(record)).not.toContain(socket0.token)
  })

  it('каждая принятая команда попадает в лог с версией, игроком и источником; отклонённая - нет', async () => {
    const repository = new MemoryMatchRepository()
    const { manager, room, socket0 } = await startedMatch(repository)

    manager.submitCommand(room, 1, 'bad', { type: COMMAND_TYPE.END_TURN }, socket0)
    manager.submitCommand(room, 0, 'ok', { type: COMMAND_TYPE.END_TURN }, socket0)
    await room.persisting

    expect(repository.commands).toHaveLength(1)
    expect(repository.commands[0]).toMatchObject({ matchId: room.id, seq: room.state!.version, player: 0, command: { type: COMMAND_TYPE.END_TURN }, source: COMMAND_SOURCE.PLAYER })
    expect(repository.matches.get(room.id)!.version).toBe(room.state!.version)
  })

  it('конец партии записывается: статус, победитель, причина и время', async () => {
    const repository = new MemoryMatchRepository()
    const { manager, room } = await startedMatch(repository)

    manager.submitCommand(room, 1, 'give-up', { type: COMMAND_TYPE.CONCEDE })
    await room.persisting

    const record = repository.matches.get(room.id)!
    expect(record).toMatchObject({ status: MATCH_STATUS.FINISHED, winner: 0, endReason: END_REASON.CONCEDE })
    expect(record.finishedAt).not.toBeNull()
    expect(await repository.loadActive()).toEqual([])
  })

  it('ошибка записи логируется, партия продолжается', async () => {
    const repository = new MemoryMatchRepository()
    const errors: unknown[] = []
    const failing = Object.assign(Object.create(repository), {
      appendCommand: async () => {
        throw new Error('база недоступна')
      },
    })
    const { manager, room, socket0 } = await startedMatch(failing, { onError: error => errors.push(error) })

    manager.submitCommand(room, 0, 'ok', { type: COMMAND_TYPE.END_TURN }, socket0)
    manager.submitCommand(room, 1, 'ok2', { type: COMMAND_TYPE.END_TURN })
    await room.persisting

    expect(socket0.lastOf(SERVER_MESSAGE.ACK).commandId).toBe('ok')
    expect(room.state!.version).toBe(2)
    expect(errors).toHaveLength(2)
  })

  it('остановка сервера дописывает очередь записей и оставляет партию активной', async () => {
    const repository = new MemoryMatchRepository()
    const { manager, room } = await startedMatch(repository)

    manager.submitCommand(room, 0, 'ok', { type: COMMAND_TYPE.END_TURN })
    await manager.dispose()

    expect(repository.commands).toHaveLength(1)
    expect(repository.matches.get(room.id)!.status).toBe(MATCH_STATUS.ACTIVE)
  })
})

describe('восстановление после перезапуска', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** Партия, сыгранная до «перезапуска»: возвращает хранилище, токены и позицию. */
  async function playedBeforeRestart() {
    const repository = new MemoryMatchRepository()
    const { manager, room, socket0, socket1 } = await startedMatch(repository, { disconnectTimeoutMs: 10_000, turnTimeoutMs: 60_000 })
    manager.submitCommand(room, 0, 'a', { type: COMMAND_TYPE.END_TURN })
    await manager.dispose()
    return { repository, id: room.id, code: room.code, version: room.state!.version, tokens: [socket0.token, socket1.token] }
  }

  it('активная партия поднимается с теми же id, кодом и состоянием, игрок возвращается по прежнему токену', async () => {
    const { repository, id, code, version, tokens } = await playedBeforeRestart()

    const manager = new MatchManager({ firstPlayer: 0, repository, disconnectTimeoutMs: 10_000, turnTimeoutMs: 60_000 })
    expect(await manager.restore()).toBe(1)
    expect(manager.roomCount).toBe(1)

    const socket = fakeSocket()
    const result = manager.reconnect(socket, id, tokens[1]!)
    expect('error' in result).toBe(false)
    expect(socket.lastOf(SERVER_MESSAGE.UPDATE)).toMatchObject({ version, names: ['Алиса', 'Боб'], endReason: null })
    expect(socket.lastOf(SERVER_MESSAGE.UPDATE).view.you).toBe(1)
    // Соперник пока не вернулся, и ему идёт отсчёт до сдачи.
    expect(socket.lastOf(SERVER_MESSAGE.OPPONENT_STATUS)).toMatchObject({ connected: false, reconnectTimeLeftMs: expect.any(Number) })
    // По коду в уже начатую партию не войти, токен чужой партии не подходит.
    expect(manager.joinMatch(fakeSocket(), code, 'Вика')).toEqual({ error: MATCH_ERROR.FULL })
    expect(manager.reconnect(fakeSocket(), id, 'чужой')).toEqual({ error: MATCH_ERROR.INVALID_TOKEN })
  })

  it('после восстановления партия идёт дальше, команды пишутся в тот же лог', async () => {
    const { repository, id, version, tokens } = await playedBeforeRestart()
    const manager = new MatchManager({ firstPlayer: 0, repository, disconnectTimeoutMs: 10_000, turnTimeoutMs: 60_000 })
    await manager.restore()

    const socket = fakeSocket()
    const { room, seat } = mustReconnect(manager, id, tokens[1]!, socket)
    manager.submitCommand(room, seat, 'b', { type: COMMAND_TYPE.END_TURN }, socket)
    await room.persisting

    expect(socket.lastOf(SERVER_MESSAGE.ACK).commandId).toBe('b')
    expect(repository.commands.map(entry => entry.seq)).toEqual([version, version + 1])
  })

  it('если вернулся один, сдачу по таймауту получает тот, кто не вернулся', async () => {
    const { repository, id, tokens } = await playedBeforeRestart()
    const manager = new MatchManager({ firstPlayer: 0, repository, disconnectTimeoutMs: 10_000, turnTimeoutMs: 600_000 })
    await manager.restore()

    const { room } = mustReconnect(manager, id, tokens[1]!)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(room.state!.winner).toBe(1)
    expect(room.endReason).toBe(END_REASON.DISCONNECT)
    await room.persisting
    expect(repository.matches.get(id)).toMatchObject({ status: MATCH_STATUS.FINISHED, winner: 1, endReason: END_REASON.DISCONNECT })
  })

  it('если не вернулся никто, партия помечается брошенной, комната удаляется, второй раз не поднимается', async () => {
    const { repository, id } = await playedBeforeRestart()
    const manager = new MatchManager({ firstPlayer: 0, repository, disconnectTimeoutMs: 10_000, turnTimeoutMs: 600_000 })
    await manager.restore()

    await vi.advanceTimersByTimeAsync(10_000)
    expect(manager.roomCount).toBe(0)
    expect(repository.matches.get(id)!.status).toBe(MATCH_STATUS.ABANDONED)

    const again = new MatchManager({ firstPlayer: 0, repository })
    expect(await again.restore()).toBe(0)
  })

  it('законченные партии не поднимаются', async () => {
    const repository = new MemoryMatchRepository()
    const { manager, room } = await startedMatch(repository)
    manager.submitCommand(room, 1, 'give-up', { type: COMMAND_TYPE.CONCEDE })
    await manager.dispose()

    expect(await new MatchManager({ repository }).restore()).toBe(0)
  })
})

describe('срок хранения', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const DAY = 24 * 60 * 60 * 1000

  it('retentionCutoff отступает от текущего момента на заданное число суток', () => {
    expect(retentionCutoff(30 * DAY, 14).getTime()).toBe(16 * DAY)
    expect(retentionCutoff(30 * DAY, 0.5).getTime()).toBe(30 * DAY - DAY / 2)
  })

  it('партии старше срока удаляются вместе с логом, свежие остаются; проверка идёт по расписанию', async () => {
    vi.setSystemTime(100 * DAY)
    const repository = new MemoryMatchRepository(() => new Date())
    const old = await startedMatch(repository)
    old.manager.submitCommand(old.room, 0, 'a', { type: COMMAND_TYPE.END_TURN })
    await old.room.persisting
    await old.manager.dispose()

    vi.setSystemTime(110 * DAY)
    const fresh = await startedMatch(repository)
    await fresh.manager.dispose()
    expect(repository.matches.size).toBe(2)

    // Через 14 суток после последнего изменения первой партии (день 100) она устаревает, вторая (день 110) - нет.
    vi.setSystemTime(115 * DAY)
    const removed: number[] = []
    const stop = startRetention(repository, { days: 14, intervalMs: DAY, onRemoved: count => removed.push(count) })
    await vi.advanceTimersByTimeAsync(0)
    expect(removed).toEqual([1])
    expect(repository.matches.has(old.room.id)).toBe(false)
    expect(repository.matches.has(fresh.room.id)).toBe(true)
    expect(repository.commands).toEqual([])

    // Спустя ещё срок хранения устаревает и вторая; интервал проверки срабатывает сам.
    await vi.advanceTimersByTimeAsync(10 * DAY)
    expect(repository.matches.size).toBe(0)
    expect(removed).toEqual([1, 1])
    stop()
  })

  it('ошибка удаления не останавливает расписание', async () => {
    const errors: unknown[] = []
    let calls = 0
    const repository = Object.assign(new MemoryMatchRepository(), {
      deleteOlderThan: async () => {
        calls += 1
        throw new Error('нет связи')
      },
    })
    const stop = startRetention(repository, { days: 14, intervalMs: DAY, onError: error => errors.push(error) })
    await vi.advanceTimersByTimeAsync(2 * DAY)
    stop()
    expect(calls).toBe(3)
    expect(errors).toHaveLength(3)
  })

  it('остановка отменяет расписание', async () => {
    let calls = 0
    const repository = Object.assign(new MemoryMatchRepository(), {
      deleteOlderThan: async () => {
        calls += 1
        return 0
      },
    })
    const stop = startRetention(repository, { days: 14, intervalMs: DAY })
    await vi.advanceTimersByTimeAsync(0)
    stop()
    await vi.advanceTimersByTimeAsync(5 * DAY)
    expect(calls).toBe(1)
  })
})
