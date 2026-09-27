import type { Command, CommandError, GameEvent, PlayerId, PlayerView } from '@space/engine'
import type { MatchError, ServerMessage } from '@space/protocol'
import { SERVER_MESSAGE } from '@space/protocol'

export type CommandResult
  = | { ok: true }
    | { ok: false, reason: CommandError | 'connection-lost' }

/** Возвращается из handleServerMessage только на JOINED: секрет для переподключения нужно сохранить снаружи (localStorage). */
export interface ReconnectInfo {
  matchId: string
  token: string
}

/**
 * Состояние подключения к матчу. Не знает ни о WebSocket, ни о Vue - только применяет входящие сообщения
 * сервера и отслеживает команды, ждущие ack/reject. Транспорт и реактивность - в useGameConnection.
 */
export class ConnectionState {
  you: PlayerId | null = null
  matchId: string | null = null
  code: string | null = null
  opponentConnected = false
  view: PlayerView | null = null
  legalActions: Command[] = []
  lastEvents: GameEvent[] = []
  lastError: MatchError | null = null

  private readonly pending = new Map<string, (result: CommandResult) => void>()

  /** Возвращает данные для переподключения, только если пришёл JOINED. */
  handleServerMessage(message: ServerMessage): ReconnectInfo | null {
    switch (message.type) {
      case SERVER_MESSAGE.JOINED:
        this.matchId = message.matchId
        this.code = message.code
        this.you = message.you
        this.opponentConnected = message.opponentConnected
        this.lastError = null
        return { matchId: message.matchId, token: message.token }

      case SERVER_MESSAGE.UPDATE:
        this.view = message.view
        this.legalActions = message.legalActions
        this.lastEvents = message.events
        this.opponentConnected = true
        return null

      case SERVER_MESSAGE.ACK:
        this.resolvePending(message.commandId, { ok: true })
        return null

      case SERVER_MESSAGE.REJECT:
        this.resolvePending(message.commandId, { ok: false, reason: message.reason })
        return null

      case SERVER_MESSAGE.ERROR:
        this.lastError = message.reason
        return null
    }
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
