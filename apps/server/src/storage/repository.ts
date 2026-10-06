import type { Command, GameState, PlayerId } from '@space/engine'
import type { EndReason } from '@space/protocol'
import type { CommandSource } from '../room.ts'

export const MATCH_STATUS = {
  /** Партия идёт (или шла, когда сервер остановился: такие поднимаются при старте). */
  ACTIVE: 'active',
  FINISHED: 'finished',
  /** Игроки ушли, не доиграв, и не вернулись. */
  ABANDONED: 'abandoned',
} as const
export type MatchStatus = (typeof MATCH_STATUS)[keyof typeof MATCH_STATUS]

/** Партия целиком: то, что нужно, чтобы поднять её после перезапуска сервера. */
export interface MatchRecord {
  id: string
  code: string
  status: MatchStatus
  /** Сид, с которым создана партия (для отладки и реплеев). */
  seed: number
  names: [string, string]
  /** Хэши токенов переподключения по номеру места: открытые токены на сервере не хранятся. */
  tokenHashes: [string, string]
  /** Полное состояние, включая скрытое (рука соперника, порядок колод, rngState): наружу не отдаётся никогда. */
  state: GameState
  version: number
  winner: PlayerId | null
  endReason: EndReason | null
  createdAt: Date
  updatedAt: Date
  finishedAt: Date | null
}

export type NewMatch = Pick<MatchRecord, 'id' | 'code' | 'seed' | 'names' | 'tokenHashes' | 'state'>

/** Принятая команда и то, что она изменила: пишется в лог команд и обновляет снимок партии. */
export interface CommandEntry {
  matchId: string
  /** Версия состояния после команды: уникальна в рамках партии и задаёт порядок. */
  seq: number
  player: PlayerId
  command: Command
  source: CommandSource
  state: GameState
  winner: PlayerId | null
  endReason: EndReason | null
}

/**
 * Хранилище партий. Игра с ним не связана жёстко: все записи идут в фоне, и ошибка записи не останавливает партию
 * (MatchManager только логирует её). Реализации: Postgres (боевая), в памяти (тесты), пустая (разработка без БД).
 */
export interface MatchRepository {
  createMatch: (match: NewMatch) => Promise<void>
  /** Одной транзакцией: запись в лог команд и обновление снимка партии (при конце - статус, победитель, причина). */
  appendCommand: (entry: CommandEntry) => Promise<void>
  markAbandoned: (matchId: string) => Promise<void>
  /** Партии, которые шли в момент остановки сервера. */
  loadActive: () => Promise<MatchRecord[]>
  /** Удаляет партии (и их лог команд), не менявшиеся с момента cutoff. Возвращает, сколько удалено. */
  deleteOlderThan: (cutoff: Date) => Promise<number>
  close: () => Promise<void>
}

/** Ничего не хранит: сервер работает как раньше, только в памяти процесса. */
export const NULL_REPOSITORY: MatchRepository = {
  createMatch: async () => {},
  appendCommand: async () => {},
  markAbandoned: async () => {},
  loadActive: async () => [],
  deleteOlderThan: async () => 0,
  close: async () => {},
}

/** Хранилище в памяти: для тестов, повторяет поведение Postgres-реализации. `now` подменяется в тестах. */
export class MemoryMatchRepository implements MatchRepository {
  readonly matches = new Map<string, MatchRecord>()
  readonly commands: CommandEntry[] = []
  closed = false

  private readonly now: () => Date

  constructor(now: () => Date = () => new Date()) {
    this.now = now
  }

  async createMatch(match: NewMatch): Promise<void> {
    if (this.matches.has(match.id))
      return
    const now = this.now()
    this.matches.set(match.id, {
      ...match,
      status: MATCH_STATUS.ACTIVE,
      version: match.state.version,
      winner: null,
      endReason: null,
      createdAt: now,
      updatedAt: now,
      finishedAt: null,
    })
  }

  async appendCommand(entry: CommandEntry): Promise<void> {
    const match = this.matches.get(entry.matchId)
    if (!match)
      return
    if (!this.commands.some(item => item.matchId === entry.matchId && item.seq === entry.seq))
      this.commands.push(entry)
    const now = this.now()
    match.state = structuredClone(entry.state)
    match.version = entry.seq
    match.winner = entry.winner
    match.endReason = entry.endReason
    match.updatedAt = now
    if (entry.winner !== null) {
      match.status = MATCH_STATUS.FINISHED
      match.finishedAt = now
    }
  }

  async markAbandoned(matchId: string): Promise<void> {
    const match = this.matches.get(matchId)
    if (match?.status === MATCH_STATUS.ACTIVE) {
      match.status = MATCH_STATUS.ABANDONED
      match.updatedAt = this.now()
    }
  }

  async loadActive(): Promise<MatchRecord[]> {
    return [...this.matches.values()].filter(match => match.status === MATCH_STATUS.ACTIVE).map(match => structuredClone(match))
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    let removed = 0
    for (const [id, match] of this.matches) {
      if (match.updatedAt < cutoff) {
        this.matches.delete(id)
        removed += 1
      }
    }
    const keep = this.commands.filter(entry => this.matches.has(entry.matchId))
    this.commands.length = 0
    this.commands.push(...keep)
    return removed
  }

  async close(): Promise<void> {
    this.closed = true
  }
}
