import type { Command, GameEvent, GameState, PlayerId } from '@space/engine'
import type { MatchError, ServerMessage } from '@space/protocol'
import type { WebSocket } from 'ws'
import { randomInt, randomUUID } from 'node:crypto'
import { apply, COMMAND_TYPE, createGame, legalActions, redact, redactEvents } from '@space/engine'
import { MATCH_ERROR, SERVER_MESSAGE } from '@space/protocol'

/** Символы без похожих друг на друга: без 0/O, 1/I/L. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

export const DEFAULT_TURN_TIMEOUT_MS = 90_000
export const DEFAULT_DISCONNECT_TIMEOUT_MS = 60_000

export interface MatchManagerOptions {
  turnTimeoutMs?: number
  disconnectTimeoutMs?: number
}

interface Seat {
  claimed: boolean
  socket: WebSocket | null
  token: string
  disconnectTimer: ReturnType<typeof setTimeout> | null
}

function createSeat(): Seat {
  return { claimed: false, socket: null, token: randomUUID(), disconnectTimer: null }
}

export class Room {
  readonly id = randomUUID()
  readonly code = generateCode()
  state: GameState | null = null
  readonly seats: [Seat, Seat] = [createSeat(), createSeat()]
  turnTimer: ReturnType<typeof setTimeout> | null = null
}

function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++)
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return code
}

function send(socket: WebSocket, message: ServerMessage): void {
  // 1 = WebSocket.OPEN. Не импортируем константу из 'ws', чтобы не тянуть лишний рантайм-объект.
  if (socket.readyState === 1)
    socket.send(JSON.stringify(message))
}

type SeatResult = { room: Room, seat: PlayerId } | { error: MatchError }

/**
 * Комнаты матчей в памяти: создание/вход по коду, переподключение, приём команд,
 * таймаут хода (автодействие) и таймаут отключения (сдача). Матчи и их лог никуда не сохраняются -
 * при перезапуске сервера все текущие партии теряются.
 */
export class MatchManager {
  private readonly rooms = new Map<string, Room>()
  private readonly codeToRoomId = new Map<string, string>()
  private readonly turnTimeoutMs: number
  private readonly disconnectTimeoutMs: number

  constructor(options: MatchManagerOptions = {}) {
    this.turnTimeoutMs = options.turnTimeoutMs ?? DEFAULT_TURN_TIMEOUT_MS
    this.disconnectTimeoutMs = options.disconnectTimeoutMs ?? DEFAULT_DISCONNECT_TIMEOUT_MS
  }

  createMatch(socket: WebSocket): { room: Room, seat: PlayerId } {
    const room = new Room()
    this.rooms.set(room.id, room)
    this.codeToRoomId.set(room.code, room.id)

    const seat = room.seats[0]
    seat.claimed = true
    seat.socket = socket

    send(socket, { type: SERVER_MESSAGE.JOINED, matchId: room.id, code: room.code, you: 0, token: seat.token, opponentConnected: false })
    return { room, seat: 0 }
  }

  joinMatch(socket: WebSocket, rawCode: string): SeatResult {
    const roomId = this.codeToRoomId.get(rawCode.trim().toUpperCase())
    const room = roomId ? this.rooms.get(roomId) : undefined
    if (!room)
      return { error: MATCH_ERROR.NOT_FOUND }
    if (room.seats[1].claimed)
      return { error: MATCH_ERROR.FULL }

    const seat = room.seats[1]
    seat.claimed = true
    seat.socket = socket
    room.state = createGame(randomInt(0, 2 ** 31))

    send(socket, { type: SERVER_MESSAGE.JOINED, matchId: room.id, code: room.code, you: 1, token: seat.token, opponentConnected: true })
    // Первый update заодно сигналит игроку 0, что соперник подключился и партия началась.
    this.broadcastUpdate(room, [])
    this.scheduleTurnTimeout(room)
    return { room, seat: 1 }
  }

  reconnect(socket: WebSocket, matchId: string, token: string): SeatResult {
    const room = this.rooms.get(matchId)
    if (!room)
      return { error: MATCH_ERROR.NOT_FOUND }

    const index = room.seats.findIndex(s => s.claimed && s.token === token)
    if (index === -1)
      return { error: MATCH_ERROR.INVALID_TOKEN }
    const seat = index as PlayerId

    const s = room.seats[seat]
    if (s.disconnectTimer) {
      clearTimeout(s.disconnectTimer)
      s.disconnectTimer = null
    }
    // Место мог всё ещё держать старый сокет (например, вкладка того же браузера случайно переподключилась
    // по чужому токену). Закрываем его: иначе сервер продолжал бы слать ему сообщения вместо нового сокета,
    // а сам старый сокет не знал бы, что потерял место.
    if (s.socket && s.socket !== socket)
      s.socket.close()
    s.socket = socket
    this.sync(room, seat)
    return { room, seat }
  }

  sync(room: Room, seat: PlayerId): void {
    const { state } = room
    const s = room.seats[seat]
    if (!state || !s.socket)
      return
    send(s.socket, {
      type: SERVER_MESSAGE.UPDATE,
      version: state.version,
      events: [],
      view: redact(state, seat),
      legalActions: legalActions(state, seat),
    })
  }

  submitCommand(room: Room, seat: PlayerId, commandId: string, command: Command, ackTo?: WebSocket): void {
    if (!room.state)
      return

    const result = apply(room.state, seat, command)
    if (!result.ok) {
      if (ackTo)
        send(ackTo, { type: SERVER_MESSAGE.REJECT, commandId, reason: result.error })
      return
    }

    room.state = result.state
    if (ackTo)
      send(ackTo, { type: SERVER_MESSAGE.ACK, commandId })
    this.broadcastUpdate(room, result.events)
    this.scheduleTurnTimeout(room)
  }

  /**
   * Сокет закрылся: если партия ещё идёт, через disconnectTimeoutMs соперник побеждает (команда CONCEDE
   * от лица отключившегося). socket сверяется с текущим: место мог уже перехватить более новый сокет
   * (см. reconnect) - тогда это устаревшее событие close, и его нужно игнорировать.
   */
  handleDisconnect(room: Room, seat: PlayerId, socket: WebSocket): void {
    const s = room.seats[seat]
    if (s.socket !== socket)
      return
    s.socket = null
    if (!room.state || room.state.winner !== null)
      return

    s.disconnectTimer = setTimeout(() => {
      s.disconnectTimer = null
      if (!room.state || room.state.winner !== null)
        return
      this.submitCommand(room, seat, `concede-${Date.now()}`, { type: COMMAND_TYPE.CONCEDE })
    }, this.disconnectTimeoutMs)
  }

  private broadcastUpdate(room: Room, events: GameEvent[]): void {
    const { state } = room
    if (!state)
      return
    for (const seat of [0, 1] as const) {
      const socket = room.seats[seat].socket
      if (!socket)
        continue
      send(socket, {
        type: SERVER_MESSAGE.UPDATE,
        version: state.version,
        events: redactEvents(events, seat),
        view: redact(state, seat),
        legalActions: legalActions(state, seat),
      })
    }
  }

  /** Если игрок, чей сейчас ход (или кто должен ответить на prompt), не действует вовремя - действие выбирается автоматически. */
  private scheduleTurnTimeout(room: Room): void {
    if (room.turnTimer) {
      clearTimeout(room.turnTimer)
      room.turnTimer = null
    }
    const { state } = room
    if (!state || state.winner !== null)
      return

    const actor = state.prompt ? state.prompt.player : state.currentPlayer
    room.turnTimer = setTimeout(() => this.autoAct(room, actor), this.turnTimeoutMs)
  }

  private autoAct(room: Room, actor: PlayerId): void {
    const { state } = room
    if (!state || state.winner !== null)
      return

    const actions = legalActions(state, actor)
    if (actions.length === 0)
      return

    const preferred = state.prompt ? COMMAND_TYPE.SKIP : COMMAND_TYPE.END_TURN
    const command = actions.find(action => action.type === preferred) ?? actions[0]!
    this.submitCommand(room, actor, `timeout-${Date.now()}`, command)
  }
}
