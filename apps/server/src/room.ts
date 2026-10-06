import type { Command, GameState, PlayerId } from '@space/engine'
import type { EndReason } from '@space/protocol'
import type { WebSocket } from 'ws'
import { Buffer } from 'node:buffer'
import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { COMMAND_TYPE } from '@space/engine'
import { DEFAULT_PLAYER_NAMES, END_REASON } from '@space/protocol'

/** Символы без похожих друг на друга: без 0/O, 1/I/L. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

export function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++)
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return code
}

/** Секрет для переподключения: 32 случайных байта. Открытым он существует только в ответе JOINED. */
export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

/** На сервере и в базе хранится только хэш токена: утечка записей не даёт войти в чужую партию. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function tokenMatches(hash: string, token: string): boolean {
  const expected = Buffer.from(hash, 'hex')
  const actual = Buffer.from(hashToken(token), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/** Кто подал команду: определяет, как объяснить конец партии, если команда была сдачей. */
export const COMMAND_SOURCE = {
  /** Команда пришла от игрока (в том числе его сдача по кнопке). */
  PLAYER: 'player',
  /** Сервер сходил за игрока по таймауту хода. */
  TIMEOUT: 'timeout',
  /** Сервер засчитал сдачу отключившемуся игроку. */
  DISCONNECT: 'disconnect',
  /** Сервер засчитал сдачу игроку, который несколько ходов подряд молчал. */
  IDLE: 'idle',
} as const
export type CommandSource = (typeof COMMAND_SOURCE)[keyof typeof COMMAND_SOURCE]

/** Причина конца партии по команде, которая её закончила. */
export function endReasonOf(command: Command, source: CommandSource): EndReason {
  if (command.type !== COMMAND_TYPE.CONCEDE)
    return END_REASON.AUTHORITY
  if (source === COMMAND_SOURCE.DISCONNECT)
    return END_REASON.DISCONNECT
  if (source === COMMAND_SOURCE.IDLE)
    return END_REASON.IDLE
  return END_REASON.CONCEDE
}

export interface Seat {
  claimed: boolean
  /** Игрок покинул место (вышел из законченной партии): вернуться на него по токену нельзя. */
  left: boolean
  name: string
  socket: WebSocket | null
  /** sha256 токена переподключения; пустая строка, пока место свободно. */
  tokenHash: string
  disconnectTimer: ReturnType<typeof setTimeout> | null
  /** Момент автоматической сдачи отключившегося игрока (Date.now(), мс); null, пока он на связи. */
  disconnectDeadline: number | null
}

function createSeat(): Seat {
  return { claimed: false, left: false, name: '', socket: null, tokenHash: '', disconnectTimer: null, disconnectDeadline: null }
}

/** Занимает место и возвращает открытый токен (хэш остаётся в месте). Пустое имя заменяется именем по умолчанию для этого места. */
export function claimSeat(seat: Seat, seatIndex: PlayerId, socket: WebSocket, name: string): string {
  const token = generateToken()
  seat.claimed = true
  seat.left = false
  seat.name = name || DEFAULT_PLAYER_NAMES[seatIndex]
  seat.socket = socket
  seat.tokenHash = hashToken(token)
  return token
}

export interface RoomInit {
  id?: string
  code: string
}

export class Room {
  readonly id: string
  readonly code: string
  state: GameState | null = null
  readonly seats: [Seat, Seat] = [createSeat(), createSeat()]
  turnTimer: ReturnType<typeof setTimeout> | null = null
  /** Момент срабатывания turnTimer (Date.now(), мс); null, пока таймера нет. */
  turnDeadline: number | null = null
  /** Таймер удаления комнаты (ожидание соперника, законченная партия). */
  cleanupTimer: ReturnType<typeof setTimeout> | null = null
  /** Сколько раз подряд сервер ходил за игрока по таймауту без его команд. */
  idleActions: [number, number] = [0, 0]
  /** Почему партия закончилась; null, пока она идёт. */
  endReason: EndReason | null = null
  /** Кто из игроков предложил реванш. */
  rematch: [boolean, boolean] = [false, false]
  /** Сид, с которым создана партия. */
  seed = 0
  /** Очередь записей в хранилище: выполняются по порядку, игра их не ждёт. */
  persisting: Promise<void> = Promise.resolve()

  constructor(init: RoomInit) {
    this.id = init.id ?? randomUUID()
    this.code = init.code
  }

  get names(): [string, string] {
    return [this.seats[0].name, this.seats[1].name]
  }

  /** Партия закончилась. */
  get finished(): boolean {
    return this.state !== null && this.state.winner !== null
  }
}

export function otherSeat(seat: PlayerId): PlayerId {
  return seat === 0 ? 1 : 0
}
