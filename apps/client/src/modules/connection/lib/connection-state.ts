import type { Command, CommandError, GameEvent, PlayerId, PlayerView } from '@space/engine'
import type { EndReason, MatchError, ServerMessage, UpdateMessage } from '@space/protocol'
import { MATCH_ERROR, SERVER_MESSAGE } from '@space/protocol'

export type CommandResult
  = | { ok: true }
    | { ok: false, reason: CommandError | 'connection-lost' }

/** Реванш после конца партии: кто предложил и возможен ли он (соперник на месте). */
export interface RematchState {
  you: boolean
  opponent: boolean
  available: boolean
}

const NO_REMATCH: RematchState = { you: false, opponent: false, available: false }

/** Возвращается из handleServerMessage только на JOINED: секрет для переподключения нужно сохранить снаружи (localStorage). */
export interface ReconnectInfo {
  matchId: string
  token: string
}

export type UpdateListener = (update: UpdateMessage) => void

/**
 * Состояние подключения к матчу. Не знает ни о WebSocket, ни о Vue - только применяет входящие сообщения
 * сервера и отслеживает команды, ждущие ack/reject. Транспорт и реактивность - в useGameConnection.
 */
export class ConnectionState {
  you: PlayerId | null = null
  matchId: string | null = null
  code: string | null = null
  opponentConnected = false
  /** Сколько мс до автоматической сдачи отключившегося соперника на момент opponentStatusAt; null, пока он на связи. */
  opponentReconnectTimeLeftMs: number | null = null
  opponentStatusAt = 0
  view: PlayerView | null = null
  legalActions: Command[] = []
  lastEvents: GameEvent[] = []
  lastError: MatchError | null = null
  /** Сколько мс до автодействия сервера было на момент последнего update; отсчитывать от updatedAt. */
  turnTimeLeftMs: number | null = null
  updatedAt = 0
  /** Имена игроков по номеру места (PlayerId). */
  names: [string, string] = ['', '']
  /** Почему партия закончилась; null, пока она идёт. */
  endReason: EndReason | null = null
  /** Игрок стоит в очереди быстрого поиска. */
  searching = false
  rematch: RematchState = { ...NO_REMATCH }

  private readonly updateListeners = new Set<UpdateListener>()
  private readonly pending = new Map<string, (result: CommandResult) => void>()

  /** Возвращает данные для переподключения, только если пришёл JOINED. */
  handleServerMessage(message: ServerMessage): ReconnectInfo | null {
    switch (message.type) {
      case SERVER_MESSAGE.JOINED:
        // Новая партия поверх старой (реванш): всё, что относилось к прошлой, забываем, как при выходе.
        if (this.matchId !== null && this.matchId !== message.matchId)
          this.leave()
        this.searching = false
        this.rematch = { ...NO_REMATCH }
        this.matchId = message.matchId
        this.code = message.code
        this.you = message.you
        this.opponentConnected = message.opponentConnected
        this.lastError = null
        return { matchId: message.matchId, token: message.token }

      case SERVER_MESSAGE.UPDATE: {
        const hadView = this.view !== null
        this.view = message.view
        this.legalActions = message.legalActions
        this.lastEvents = message.events
        this.turnTimeLeftMs = message.turnTimeLeftMs
        this.names = message.names
        this.endReason = message.endReason
        this.updatedAt = Date.now()
        // Update приходит и пока соперник отключён (автоход по таймауту): статус меняет только OPPONENT_STATUS.
        // Исключение - самый первый update матча: раз партия идёт, соперник на месте.
        if (!hadView)
          this.opponentConnected = true
        for (const listener of this.updateListeners)
          listener(message)
        return null
      }

      case SERVER_MESSAGE.OPPONENT_STATUS:
        this.opponentConnected = message.connected
        this.opponentReconnectTimeLeftMs = message.reconnectTimeLeftMs
        this.opponentStatusAt = Date.now()
        return null

      case SERVER_MESSAGE.SEARCH_STATUS:
        this.searching = message.searching
        return null

      case SERVER_MESSAGE.REMATCH_STATUS:
        this.rematch = { you: message.you, opponent: message.opponent, available: message.available }
        return null

      case SERVER_MESSAGE.ACK:
        this.resolvePending(message.commandId, { ok: true })
        return null

      case SERVER_MESSAGE.REJECT:
        this.resolvePending(message.commandId, { ok: false, reason: message.reason })
        return null

      case SERVER_MESSAGE.ERROR:
        // Комната удалена, пока мы ждали соперника: матча больше нет, возвращаемся в лобби с пояснением.
        if (message.reason === MATCH_ERROR.EXPIRED)
          this.leave()
        this.lastError = message.reason
        return null
    }
  }

  /** Подписка на каждый update целиком (с событиями): нужна экрану матча, чтобы анимировать события по очереди. */
  subscribeUpdates(listener: UpdateListener): () => void {
    this.updateListeners.add(listener)
    return () => this.updateListeners.delete(listener)
  }

  /** Выход из матча (кнопка «новый матч»): забываем всё, что относилось к нему. */
  leave(): void {
    this.you = null
    this.matchId = null
    this.code = null
    this.opponentConnected = false
    this.opponentReconnectTimeLeftMs = null
    this.view = null
    this.legalActions = []
    this.lastEvents = []
    this.lastError = null
    this.turnTimeLeftMs = null
    this.names = ['', '']
    this.endReason = null
    this.rematch = { ...NO_REMATCH }
    this.rejectAllPending()
  }

  /** Соединение с сервером оборвалось: очередь поиска на сервере потеряна, ждать в ней больше нечего. */
  handleDisconnected(): void {
    this.searching = false
    this.rejectAllPending()
  }

  registerPending(commandId: string, resolve: (result: CommandResult) => void): void {
    this.pending.set(commandId, resolve)
  }

  /** Соединение разорвано: команды, для которых мог не дойти ack/reject, зависать не должны. */
  rejectAllPending(): void {
    for (const resolve of this.pending.values())
      resolve({ ok: false, reason: 'connection-lost' })
    this.pending.clear()
  }

  private resolvePending(commandId: string, result: CommandResult): void {
    this.pending.get(commandId)?.(result)
    this.pending.delete(commandId)
  }
}
