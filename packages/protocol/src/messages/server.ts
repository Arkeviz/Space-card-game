import type { Command, CommandError, GameEvent, PlayerId, PlayerView } from '@space/engine'

/*
 * Сообщения сервера не проверяются схемами Valibot в рантайме: сервер - авторитетный источник,
 * их форму уже гарантирует TypeScript в момент отправки. Схемы здесь только для клиента,
 * который получает данные из сети и не должен доверять им вслепую (см. messages/client.ts).
 */
export const SERVER_MESSAGE = {
  /** Ответ на CREATE_MATCH/JOIN_MATCH/RECONNECT: игрок занял место в матче. */
  JOINED: 'joined',
  /** Снимок состояния для конкретного игрока: events - что произошло с прошлого update, view - урезанное состояние. */
  UPDATE: 'update',
  /** Команда игрока принята. */
  ACK: 'ack',
  /** Команда игрока отклонена. */
  REJECT: 'reject',
  /** Ошибка уровня матча (не связанная с конкретной командой): неверный код, матч заполнен и т. п. */
  ERROR: 'error',
} as const

export const MATCH_ERROR = {
  NOT_FOUND: 'not-found',
  FULL: 'full',
  INVALID_TOKEN: 'invalid-token',
  NOT_IN_MATCH: 'not-in-match',
  ALREADY_IN_MATCH: 'already-in-match',
} as const
export type MatchError = (typeof MATCH_ERROR)[keyof typeof MATCH_ERROR]

export interface JoinedMessage {
  type: typeof SERVER_MESSAGE.JOINED
  matchId: string
  /** Код для второго игрока. После того как оба заняли места, для входа больше не действует. */
  code: string
  you: PlayerId
  /** Секрет для RECONNECT. Хранить только на клиенте, не логировать. */
  token: string
  opponentConnected: boolean
}

export interface UpdateMessage {
  type: typeof SERVER_MESSAGE.UPDATE
  version: number
  /** События с прошлого update. Пусто у самого первого update и у ответа на SYNC. */
  events: GameEvent[]
  view: PlayerView
  legalActions: Command[]
  /** Сколько мс осталось до автодействия сервера (таймаут бездействия обновляется после каждой команды); null, если партия окончена. */
  turnTimeLeftMs: number | null
}

export interface AckMessage {
  type: typeof SERVER_MESSAGE.ACK
  commandId: string
}

export interface RejectMessage {
  type: typeof SERVER_MESSAGE.REJECT
  commandId: string
  reason: CommandError
}

export interface ErrorMessage {
  type: typeof SERVER_MESSAGE.ERROR
  reason: MatchError
}

export type ServerMessage = AckMessage | ErrorMessage | JoinedMessage | RejectMessage | UpdateMessage
