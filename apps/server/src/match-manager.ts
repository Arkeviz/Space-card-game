import type { Command, GameEvent, GameState, PlayerId } from '@space/engine'
import type { MatchError, ServerMessage } from '@space/protocol'
import type { WebSocket } from 'ws'
import { randomInt, randomUUID } from 'node:crypto'
import { apply, COMMAND_TYPE, createGame, legalActions, redact, redactEvents } from '@space/engine'
import { MATCH_ERROR, SERVER_MESSAGE } from '@space/protocol'

/** Символы без похожих друг на друга: без 0/O, 1/I/L. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

export const DEFAULT_TURN_TIMEOUT_MS = 120_000
export const DEFAULT_DISCONNECT_TIMEOUT_MS = 90_000
/** Комната, в которую так никто и не вошёл, удаляется через это время после создания. */
export const DEFAULT_WAITING_TIMEOUT_MS = 15 * 60_000
/** Законченная партия остаётся ещё на это время: игроки могут переподключиться и увидеть итог. */
export const DEFAULT_FINISHED_TTL_MS = 10 * 60_000
/** Сколько раз подряд сервер может сходить за игрока по таймауту, прежде чем засчитать ему сдачу (игрок ушёл, а вкладка открыта). */
export const DEFAULT_MAX_IDLE_ACTIONS = 3

export interface MatchManagerOptions {
  turnTimeoutMs?: number
  disconnectTimeoutMs?: number
  waitingTimeoutMs?: number
  finishedTtlMs?: number
  maxIdleActions?: number
  /** Зафиксировать первого игрока (для тестов). По умолчанию он выбирается случайно при создании партии. */
  firstPlayer?: PlayerId
}

interface Seat {
  claimed: boolean
  socket: WebSocket | null
  token: string
  disconnectTimer: ReturnType<typeof setTimeout> | null
  /** Момент автоматической сдачи отключившегося игрока (Date.now(), мс); null, пока он на связи. */
  disconnectDeadline: number | null
}

function createSeat(): Seat {
  return { claimed: false, socket: null, token: randomUUID(), disconnectTimer: null, disconnectDeadline: null }
}

export class Room {
  readonly id = randomUUID()
  readonly code = generateCode()
  state: GameState | null = null
  readonly seats: [Seat, Seat] = [createSeat(), createSeat()]
  turnTimer: ReturnType<typeof setTimeout> | null = null
  /** Момент срабатывания turnTimer (Date.now(), мс); null, пока таймера нет. */
  turnDeadline: number | null = null
  /** Таймер удаления комнаты (ожидание соперника, законченная партия). */
  cleanupTimer: ReturnType<typeof setTimeout> | null = null
  /** Сколько раз подряд сервер ходил за игрока по таймауту без его команд. */
  idleActions: [number, number] = [0, 0]
}

function other(seat: PlayerId): PlayerId {
  return seat === 0 ? 1 : 0
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
  private readonly waitingTimeoutMs: number
  private readonly finishedTtlMs: number
  private readonly maxIdleActions: number
  private readonly firstPlayer: PlayerId | undefined

  constructor(options: MatchManagerOptions = {}) {
    this.turnTimeoutMs = options.turnTimeoutMs ?? DEFAULT_TURN_TIMEOUT_MS
    this.disconnectTimeoutMs = options.disconnectTimeoutMs ?? DEFAULT_DISCONNECT_TIMEOUT_MS
    this.waitingTimeoutMs = options.waitingTimeoutMs ?? DEFAULT_WAITING_TIMEOUT_MS
    this.finishedTtlMs = options.finishedTtlMs ?? DEFAULT_FINISHED_TTL_MS
    this.maxIdleActions = options.maxIdleActions ?? DEFAULT_MAX_IDLE_ACTIONS
    this.firstPlayer = options.firstPlayer
  }

  /** Сколько комнат сейчас хранится (для тестов и диагностики). */
  get roomCount(): number {
    return this.rooms.size
  }

  /** Останавливает все таймеры (остановка сервера, конец теста). */
  dispose(): void {
    for (const room of [...this.rooms.values()])
      this.deleteRoom(room)
  }

  createMatch(socket: WebSocket): { room: Room, seat: PlayerId } {
    const room = new Room()
    this.rooms.set(room.id, room)
    this.codeToRoomId.set(room.code, room.id)

    const seat = room.seats[0]
    seat.claimed = true
    seat.socket = socket
    this.scheduleCleanup(room, this.waitingTimeoutMs)

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
    room.state = createGame(randomInt(0, 2 ** 31), { firstPlayer: this.firstPlayer })
    this.clearCleanup(room)

    send(socket, { type: SERVER_MESSAGE.JOINED, matchId: room.id, code: room.code, you: 1, token: seat.token, opponentConnected: true })
    // Первый update заодно сигналит игроку 0, что соперник подключился и партия началась.
    this.scheduleTurnTimeout(room)
    this.sendOpponentStatus(room, 0)
    this.broadcastUpdate(room, [])
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
    s.disconnectDeadline = null
    // Место мог всё ещё держать старый сокет (например, вкладка того же браузера случайно переподключилась
    // по чужому токену). Закрываем его: иначе сервер продолжал бы слать ему сообщения вместо нового сокета,
    // а сам старый сокет не знал бы, что потерял место.
    if (s.socket && s.socket !== socket)
      s.socket.close()
    s.socket = socket
    // Создатель вернулся, пока ждал соперника: срок ожидания отсчитывается заново.
    if (!room.state)
      this.scheduleCleanup(room, this.waitingTimeoutMs)
    this.sync(room, seat)
    this.sendOpponentStatus(room, seat)
    this.sendOpponentStatus(room, other(seat))
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
      turnTimeLeftMs: this.turnTimeLeftMs(room),
    })
  }

  submitCommand(room: Room, seat: PlayerId, commandId: string, command: Command, ackTo?: WebSocket): void {
    if (!room.state)
      return

    // Человек подал команду (ackTo - его сокет): отсчёт «ушёл, а вкладка открыта» начинается заново.
    if (ackTo)
      room.idleActions[seat] = 0

    const result = apply(room.state, seat, command)
    if (!result.ok) {
      if (ackTo)
        send(ackTo, { type: SERVER_MESSAGE.REJECT, commandId, reason: result.error })
      return
    }

    room.state = result.state
    if (ackTo)
      send(ackTo, { type: SERVER_MESSAGE.ACK, commandId })
    this.scheduleTurnTimeout(room)
    this.broadcastUpdate(room, result.events)
    if (room.state.winner !== null)
      this.scheduleCleanup(room, this.finishedTtlMs)
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
    if (!room.state) {
      // Создатель ушёл, не дождавшись соперника: ждём его возвращения, но не дольше таймаута отключения.
      this.scheduleCleanup(room, this.disconnectTimeoutMs)
      return
    }
    if (room.state.winner !== null)
      return

    s.disconnectDeadline = Date.now() + this.disconnectTimeoutMs
    s.disconnectTimer = setTimeout(() => {
      s.disconnectTimer = null
      s.disconnectDeadline = null
      if (!room.state || room.state.winner !== null)
        return
      this.submitCommand(room, seat, `concede-${Date.now()}`, { type: COMMAND_TYPE.CONCEDE })
    }, this.disconnectTimeoutMs)
    this.sendOpponentStatus(room, other(seat))
  }

  /** Сообщает игроку viewer, на связи ли его соперник и сколько осталось до автоматической сдачи. */
  private sendOpponentStatus(room: Room, viewer: PlayerId): void {
    const socket = room.seats[viewer].socket
    const opponent = room.seats[other(viewer)]
    if (!socket || !room.state)
      return
    send(socket, {
      type: SERVER_MESSAGE.OPPONENT_STATUS,
      connected: opponent.socket !== null,
      reconnectTimeLeftMs: opponent.disconnectDeadline === null ? null : Math.max(0, opponent.disconnectDeadline - Date.now()),
    })
  }

  private clearCleanup(room: Room): void {
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer)
      room.cleanupTimer = null
    }
  }

  /** Комната удаляется через ms, если за это время её не вернули к жизни (clearCleanup / новый scheduleCleanup). */
  private scheduleCleanup(room: Room, ms: number): void {
    this.clearCleanup(room)
    room.cleanupTimer = setTimeout(() => this.expire(room), ms)
    room.cleanupTimer.unref()
  }

  private expire(room: Room): void {
    // Ждавший соперника создатель узнаёт, что комната закрыта; законченную партию игроки уже видели.
    if (!room.state) {
      const socket = room.seats[0].socket
      if (socket)
        send(socket, { type: SERVER_MESSAGE.ERROR, reason: MATCH_ERROR.EXPIRED })
    }
    this.deleteRoom(room)
  }

  private deleteRoom(room: Room): void {
    this.clearCleanup(room)
    if (room.turnTimer)
      clearTimeout(room.turnTimer)
    room.turnTimer = null
    room.turnDeadline = null
    for (const seat of room.seats) {
      if (seat.disconnectTimer)
        clearTimeout(seat.disconnectTimer)
      seat.disconnectTimer = null
      seat.disconnectDeadline = null
      seat.socket?.close()
      seat.socket = null
    }
    this.rooms.delete(room.id)
    this.codeToRoomId.delete(room.code)
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
        turnTimeLeftMs: this.turnTimeLeftMs(room),
      })
    }
  }

  /** Сколько осталось до автодействия. Относительное значение клиенту удобнее абсолютного: не зависит от разницы часов. */
  private turnTimeLeftMs(room: Room): number | null {
    return room.turnDeadline === null ? null : Math.max(0, room.turnDeadline - Date.now())
  }

  /** Если игрок, чей сейчас ход (или кто должен ответить на prompt), не действует вовремя - действие выбирается автоматически. */
  private scheduleTurnTimeout(room: Room): void {
    if (room.turnTimer) {
      clearTimeout(room.turnTimer)
      room.turnTimer = null
    }
    room.turnDeadline = null
    const { state } = room
    if (!state || state.winner !== null)
      return

    const actor = state.prompt ? state.prompt.player : state.currentPlayer
    room.turnDeadline = Date.now() + this.turnTimeoutMs
    room.turnTimer = setTimeout(() => this.autoAct(room, actor), this.turnTimeoutMs)
  }

  private autoAct(room: Room, actor: PlayerId): void {
    const { state } = room
    if (!state || state.winner !== null)
      return

    const actions = legalActions(state, actor)
    if (actions.length === 0)
      return

    // Игрок молчит несколько ходов подряд (ушёл от компьютера, вкладка открыта): партия не должна идти вечно.
    room.idleActions[actor] += 1
    if (room.idleActions[actor] >= this.maxIdleActions) {
      this.submitCommand(room, actor, `idle-${Date.now()}`, { type: COMMAND_TYPE.CONCEDE })
      return
    }

    const preferred = state.prompt ? COMMAND_TYPE.SKIP : COMMAND_TYPE.END_TURN
    const command = actions.find(action => action.type === preferred) ?? actions[0]!
    this.submitCommand(room, actor, `timeout-${Date.now()}`, command)
  }
}
