import type { Command, GameEvent, PlayerId } from '@space/engine'
import type { MatchError, ServerMessage } from '@space/protocol'
import type { WebSocket } from 'ws'
import type { CommandSource } from './room.ts'
import type { MatchRepository } from './storage/repository.ts'
import { randomInt } from 'node:crypto'
import process from 'node:process'
import { apply, COMMAND_TYPE, createGame, legalActions, redact, redactEvents } from '@space/engine'
import { MATCH_ERROR, SERVER_MESSAGE } from '@space/protocol'
import { claimSeat, COMMAND_SOURCE, endReasonOf, generateCode, otherSeat, Room, tokenMatches } from './room.ts'
import { NULL_REPOSITORY } from './storage/repository.ts'

export { Room } from './room.ts'

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
  /** Куда сохранять партии. По умолчанию никуда: всё живёт в памяти процесса. */
  repository?: MatchRepository
  /** Куда сообщать об ошибках записи в хранилище (по умолчанию - в stderr). Партия при этом продолжается. */
  onError?: (error: unknown) => void
}

/** За каким местом какой комнаты закреплён сокет. */
export interface Binding {
  room: Room
  seat: PlayerId
}

type SeatResult = Binding | { error: MatchError }

interface Searcher {
  socket: WebSocket
  name: string
}

/** 1 = WebSocket.OPEN. Не импортируем константу из 'ws', чтобы не тянуть лишний рантайм-объект. */
const SOCKET_OPEN = 1

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === SOCKET_OPEN)
    socket.send(JSON.stringify(message))
}

/**
 * Комнаты матчей в памяти: создание, вход по коду, быстрый поиск, переподключение, приём команд, реванш,
 * таймаут хода (автодействие) и таймаут отключения (сдача). Сокет закрепляется за местом в комнате (bindings):
 * при поиске и реванше место меняется у сокета, который сам ничего не присылал.
 */
export class MatchManager {
  private readonly rooms = new Map<string, Room>()
  private readonly codeToRoomId = new Map<string, string>()
  private readonly bindings = new Map<WebSocket, Binding>()
  /** Очередь быстрого поиска: сводятся первые двое. */
  private queue: Searcher[] = []
  private readonly turnTimeoutMs: number
  private readonly disconnectTimeoutMs: number
  private readonly waitingTimeoutMs: number
  private readonly finishedTtlMs: number
  private readonly maxIdleActions: number
  private readonly firstPlayer: PlayerId | undefined
  private readonly repository: MatchRepository
  private readonly onError: (error: unknown) => void

  constructor(options: MatchManagerOptions = {}) {
    this.repository = options.repository ?? NULL_REPOSITORY
    this.onError = options.onError ?? ((error) => {
      process.stderr.write(`Ошибка записи в хранилище партий: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
    })
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

  /** Сколько игроков ждёт соперника в быстром поиске. */
  get searchingCount(): number {
    return this.queue.length
  }

  /** За каким местом закреплён сокет; undefined, если он не в матче. */
  bindingOf(socket: WebSocket): Binding | undefined {
    return this.bindings.get(socket)
  }

  /**
   * Останавливает все таймеры, закрывает соединения и дожидается записей в хранилище (остановка сервера, конец теста).
   * Идущие партии в хранилище остаются активными: при следующем запуске их поднимет restore().
   */
  async dispose(): Promise<void> {
    this.queue = []
    const rooms = [...this.rooms.values()]
    for (const room of rooms)
      this.deleteRoom(room, true)
    await Promise.all(rooms.map(room => room.persisting))
  }

  /**
   * Поднимает партии, которые шли в момент остановки сервера: места заняты, сокетов нет. Игроки переподключаются
   * сами (клиент помнит токен). Обоим идёт отсчёт отключения: кто-то вернулся - его соперник при необходимости
   * сдаётся по таймауту, не вернулся никто - партия помечается брошенной. Возвращает, сколько партий поднято.
   */
  async restore(): Promise<number> {
    const records = await this.repository.loadActive()
    for (const record of records) {
      const room = new Room({ id: record.id, code: record.code })
      room.state = record.state
      room.seed = record.seed
      record.names.forEach((name, index) => {
        const seat = room.seats[index as PlayerId]
        seat.claimed = true
        seat.name = name
        seat.tokenHash = record.tokenHashes[index as PlayerId]
      })
      this.rooms.set(room.id, room)
      this.codeToRoomId.set(room.code, room.id)
      this.scheduleTurnTimeout(room)
      this.startDisconnectTimer(room, 0)
      this.startDisconnectTimer(room, 1)
    }
    return records.length
  }

  /** Запись в хранилище в фоне: по порядку внутри комнаты, ошибка логируется и партию не останавливает. */
  private persist(room: Room, task: () => Promise<void>): void {
    room.persisting = room.persisting.then(task).catch(this.onError)
  }

  /* ---------- Вход в матч ---------- */

  createMatch(socket: WebSocket, name: string): Binding {
    this.removeFromQueue(socket)
    const room = this.newRoom()
    const token = claimSeat(room.seats[0], socket, name)
    this.bind(socket, room, 0)
    this.scheduleCleanup(room, this.waitingTimeoutMs)

    send(socket, { type: SERVER_MESSAGE.JOINED, matchId: room.id, code: room.code, you: 0, token, opponentConnected: false })
    return { room, seat: 0 }
  }

  joinMatch(socket: WebSocket, rawCode: string, name: string): SeatResult {
    const roomId = this.codeToRoomId.get(rawCode.trim().toUpperCase())
    const room = roomId ? this.rooms.get(roomId) : undefined
    if (!room)
      return { error: MATCH_ERROR.NOT_FOUND }
    if (room.seats[1].claimed)
      return { error: MATCH_ERROR.FULL }

    this.removeFromQueue(socket)
    const token = claimSeat(room.seats[1], socket, name)
    this.bind(socket, room, 1)
    send(socket, { type: SERVER_MESSAGE.JOINED, matchId: room.id, code: room.code, you: 1, token, opponentConnected: true })
    this.startRoom(room)
    return { room, seat: 1 }
  }

  /** Быстрый поиск: если кто-то уже ждёт, партия начинается сразу, иначе игрок встаёт в очередь. */
  findMatch(socket: WebSocket, name: string): void {
    this.queue = this.queue.filter(entry => entry.socket.readyState === SOCKET_OPEN)
    if (this.queue.some(entry => entry.socket === socket)) {
      send(socket, { type: SERVER_MESSAGE.SEARCH_STATUS, searching: true })
      return
    }
    const waiting = this.queue.shift()
    if (waiting) {
      this.startPaired([waiting, { socket, name }])
      return
    }
    this.queue.push({ socket, name })
    send(socket, { type: SERVER_MESSAGE.SEARCH_STATUS, searching: true })
  }

  cancelSearch(socket: WebSocket): void {
    this.removeFromQueue(socket)
    send(socket, { type: SERVER_MESSAGE.SEARCH_STATUS, searching: false })
  }

  reconnect(socket: WebSocket, matchId: string, token: string): SeatResult {
    const room = this.rooms.get(matchId)
    if (!room)
      return { error: MATCH_ERROR.NOT_FOUND }

    const index = room.seats.findIndex(s => s.claimed && !s.left && tokenMatches(s.tokenHash, token))
    if (index === -1)
      return { error: MATCH_ERROR.INVALID_TOKEN }
    const seat = index as PlayerId

    this.removeFromQueue(socket)
    const s = room.seats[seat]
    if (s.disconnectTimer) {
      clearTimeout(s.disconnectTimer)
      s.disconnectTimer = null
    }
    s.disconnectDeadline = null
    // Место мог всё ещё держать старый сокет (например, вкладка того же браузера случайно переподключилась
    // по чужому токену). Закрываем его: иначе сервер продолжал бы слать ему сообщения вместо нового сокета,
    // а сам старый сокет не знал бы, что потерял место.
    if (s.socket && s.socket !== socket) {
      this.bindings.delete(s.socket)
      s.socket.close()
    }
    s.socket = socket
    this.bind(socket, room, seat)
    // Создатель вернулся, пока ждал соперника: срок ожидания отсчитывается заново.
    if (!room.state)
      this.scheduleCleanup(room, this.waitingTimeoutMs)
    this.sync(room, seat)
    this.sendOpponentStatus(room, seat)
    this.sendOpponentStatus(room, otherSeat(seat))
    if (room.finished)
      this.sendRematchStatus(room)
    return { room, seat }
  }

  /**
   * Игрок уходит из матча (кнопка «новый матч» и «отменить»): ожидающая комната закрывается, идущая партия
   * засчитывается ему как сдача, у законченной отменяется предложение реванша. Сокет остаётся открытым.
   */
  leaveMatch(socket: WebSocket): void {
    this.removeFromQueue(socket)
    const binding = this.bindings.get(socket)
    if (!binding)
      return
    const { room, seat } = binding
    if (!room.state) {
      this.deleteRoom(room, false)
      return
    }

    // Сначала место освобождается, чтобы ушедший не получил итоговый update и не вернулся на экран матча.
    const s = room.seats[seat]
    s.socket = null
    s.left = true
    if (s.disconnectTimer)
      clearTimeout(s.disconnectTimer)
    s.disconnectTimer = null
    s.disconnectDeadline = null
    this.bindings.delete(socket)
    room.rematch[seat] = false
    if (!room.finished)
      this.submitCommand(room, seat, `leave-${Date.now()}`, { type: COMMAND_TYPE.CONCEDE })
    this.sendRematchStatus(room)
  }

  /** Игрок предлагает реванш; если соперник уже предложил, партия начинается сразу. */
  requestRematch(socket: WebSocket): void {
    const binding = this.bindings.get(socket)
    if (!binding)
      return
    const { room, seat } = binding
    if (!room.finished || !room.seats[otherSeat(seat)].socket)
      return
    room.rematch[seat] = true
    if (room.rematch[0] && room.rematch[1]) {
      // Сокеты и имена берутся до удаления комнаты: оно освобождает места.
      const players = room.seats.map(s => ({ socket: s.socket!, name: s.name })) as [Searcher, Searcher]
      this.deleteRoom(room, false)
      this.startPaired(players)
      return
    }
    this.sendRematchStatus(room)
  }

  /* ---------- Игра ---------- */

  sync(room: Room, seat: PlayerId): void {
    const { state } = room
    const s = room.seats[seat]
    if (!state || !s.socket)
      return
    send(s.socket, this.updateFor(room, seat, []))
  }

  submitCommand(room: Room, seat: PlayerId, commandId: string, command: Command, ackTo?: WebSocket, source: CommandSource = COMMAND_SOURCE.PLAYER): void {
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
    if (room.state.winner !== null)
      room.endReason = endReasonOf(command, source)
    const entry = {
      matchId: room.id,
      seq: room.state.version,
      player: seat,
      command,
      source,
      state: room.state,
      winner: room.state.winner,
      endReason: room.endReason,
    }
    this.persist(room, () => this.repository.appendCommand(entry))
    if (ackTo)
      send(ackTo, { type: SERVER_MESSAGE.ACK, commandId })
    this.scheduleTurnTimeout(room)
    this.broadcastUpdate(room, result.events)
    if (room.finished) {
      this.scheduleCleanup(room, this.finishedTtlMs)
      this.sendRematchStatus(room)
    }
  }

  /** Сокет закрылся (вызывается из app.ts на событие close). */
  handleClose(socket: WebSocket): void {
    this.removeFromQueue(socket)
    const binding = this.bindings.get(socket)
    if (binding)
      this.handleDisconnect(binding.room, binding.seat, socket)
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
    this.bindings.delete(socket)
    if (!room.state) {
      // Создатель ушёл, не дождавшись соперника: ждём его возвращения, но не дольше таймаута отключения.
      this.scheduleCleanup(room, this.disconnectTimeoutMs)
      return
    }
    if (room.finished) {
      // Реванш без отключившегося невозможен; когда он вернётся, предложение придётся сделать заново.
      room.rematch[seat] = false
      this.sendRematchStatus(room)
      return
    }

    this.startDisconnectTimer(room, seat)
    this.sendOpponentStatus(room, otherSeat(seat))
  }

  /** Отсчёт до автоматической сдачи места, за которым нет сокета (отключение или восстановление после перезапуска). */
  private startDisconnectTimer(room: Room, seat: PlayerId): void {
    const s = room.seats[seat]
    s.disconnectDeadline = Date.now() + this.disconnectTimeoutMs
    s.disconnectTimer = setTimeout(() => {
      s.disconnectTimer = null
      s.disconnectDeadline = null
      if (!room.state || room.finished)
        return
      // Не вернулся никто: победителя нет, партия просто брошена.
      if (!room.seats[otherSeat(seat)].socket) {
        this.abandon(room)
        return
      }
      this.submitCommand(room, seat, `concede-${Date.now()}`, { type: COMMAND_TYPE.CONCEDE }, undefined, COMMAND_SOURCE.DISCONNECT)
    }, this.disconnectTimeoutMs)
  }

  private abandon(room: Room): void {
    this.persist(room, () => this.repository.markAbandoned(room.id))
    this.deleteRoom(room, true)
  }

  /* ---------- Внутреннее ---------- */

  private newRoom(): Room {
    let code = generateCode()
    while (this.codeToRoomId.has(code))
      code = generateCode()
    const room = new Room({ code })
    this.rooms.set(room.id, room)
    this.codeToRoomId.set(room.code, room.id)
    return room
  }

  private bind(socket: WebSocket, room: Room, seat: PlayerId): void {
    this.bindings.set(socket, { room, seat })
  }

  private removeFromQueue(socket: WebSocket): boolean {
    const before = this.queue.length
    this.queue = this.queue.filter(entry => entry.socket !== socket)
    return this.queue.length !== before
  }

  /** Новая комната для двоих (быстрый поиск, реванш): оба получают JOINED с новым токеном, и партия начинается. */
  private startPaired(players: [Searcher, Searcher]): void {
    const room = this.newRoom()
    players.forEach((player, index) => {
      const seat = index as PlayerId
      const token = claimSeat(room.seats[seat], player.socket, player.name)
      this.bind(player.socket, room, seat)
      send(player.socket, { type: SERVER_MESSAGE.JOINED, matchId: room.id, code: room.code, you: seat, token, opponentConnected: true })
    })
    this.startRoom(room)
  }

  /** Оба места заняты: создаётся партия, запускаются таймеры, обоим уходят статус соперника и первый update. */
  private startRoom(room: Room): void {
    room.seed = randomInt(0, 2 ** 31)
    room.state = createGame(room.seed, { firstPlayer: this.firstPlayer })
    const created = {
      id: room.id,
      code: room.code,
      seed: room.seed,
      names: room.names,
      tokenHashes: [room.seats[0].tokenHash, room.seats[1].tokenHash] as [string, string],
      state: room.state,
    }
    this.persist(room, () => this.repository.createMatch(created))
    this.clearCleanup(room)
    this.scheduleTurnTimeout(room)
    this.sendOpponentStatus(room, 0)
    this.sendOpponentStatus(room, 1)
    this.broadcastUpdate(room, [])
  }

  /** Сообщает игроку viewer, на связи ли его соперник и сколько осталось до автоматической сдачи. */
  private sendOpponentStatus(room: Room, viewer: PlayerId): void {
    const socket = room.seats[viewer].socket
    const opponent = room.seats[otherSeat(viewer)]
    if (!socket || !room.state)
      return
    send(socket, {
      type: SERVER_MESSAGE.OPPONENT_STATUS,
      connected: opponent.socket !== null,
      reconnectTimeLeftMs: opponent.disconnectDeadline === null ? null : Math.max(0, opponent.disconnectDeadline - Date.now()),
    })
  }

  /** Кто хочет реванш и возможен ли он: соперник должен быть на месте. */
  private sendRematchStatus(room: Room): void {
    for (const seat of [0, 1] as const) {
      const socket = room.seats[seat].socket
      if (!socket)
        continue
      const opponent = otherSeat(seat)
      send(socket, {
        type: SERVER_MESSAGE.REMATCH_STATUS,
        you: room.rematch[seat],
        opponent: room.rematch[opponent],
        available: room.seats[opponent].socket !== null,
      })
    }
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
    this.deleteRoom(room, !room.state)
  }

  /** closeSockets: закрыть соединения игроков (остановка сервера, закрытие ожидающей комнаты) или только отвязать их. */
  private deleteRoom(room: Room, closeSockets: boolean): void {
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
      if (seat.socket) {
        this.bindings.delete(seat.socket)
        if (closeSockets)
          seat.socket.close()
      }
      seat.socket = null
    }
    this.rooms.delete(room.id)
    this.codeToRoomId.delete(room.code)
  }

  private updateFor(room: Room, seat: PlayerId, events: GameEvent[]): ServerMessage {
    const state = room.state!
    return {
      type: SERVER_MESSAGE.UPDATE,
      version: state.version,
      events: redactEvents(events, seat),
      view: redact(state, seat),
      legalActions: legalActions(state, seat),
      turnTimeLeftMs: this.turnTimeLeftMs(room),
      names: room.names,
      endReason: room.endReason,
    }
  }

  private broadcastUpdate(room: Room, events: GameEvent[]): void {
    if (!room.state)
      return
    for (const seat of [0, 1] as const) {
      const socket = room.seats[seat].socket
      if (socket)
        send(socket, this.updateFor(room, seat, events))
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
      this.submitCommand(room, actor, `idle-${Date.now()}`, { type: COMMAND_TYPE.CONCEDE }, undefined, COMMAND_SOURCE.IDLE)
      return
    }

    const preferred = state.prompt ? COMMAND_TYPE.SKIP : COMMAND_TYPE.END_TURN
    const command = actions.find(action => action.type === preferred) ?? actions[0]!
    this.submitCommand(room, actor, `timeout-${Date.now()}`, command, undefined, COMMAND_SOURCE.TIMEOUT)
  }
}
