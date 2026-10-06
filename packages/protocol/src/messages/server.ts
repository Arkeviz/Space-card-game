import type { Command, CommandError, GameEvent, PlayerId, PlayerView } from '@space/engine'

/*
 * Сообщения сервера не проверяются схемами Zod в рантайме: сервер - авторитетный источник,
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
  /** Соперник отключился или вернулся: нужен для индикатора связи и отсчёта до автоматической сдачи. */
  OPPONENT_STATUS: 'opponent-status',
  /** Игрок встал в очередь быстрого поиска или вышел из неё. */
  SEARCH_STATUS: 'search-status',
  /** Кто из игроков хочет реванш и возможен ли он вообще. */
  REMATCH_STATUS: 'rematch-status',
  /** Ошибка уровня матча (не связанная с конкретной командой): неверный код, матч заполнен и т. п. */
  ERROR: 'error',
} as const

/** Чем закончилась партия. */
export const END_REASON = {
  /** Авторитет проигравшего обнулён. */
  AUTHORITY: 'authority',
  /** Игрок сдался сам. */
  CONCEDE: 'concede',
  /** Игрок отключился и не вернулся за отведённое время. */
  DISCONNECT: 'disconnect',
  /** Игрок несколько ходов подряд ничего не делал: ему засчитана сдача. */
  IDLE: 'idle',
} as const
export type EndReason = (typeof END_REASON)[keyof typeof END_REASON]

export const MATCH_ERROR = {
  NOT_FOUND: 'not-found',
  FULL: 'full',
  INVALID_TOKEN: 'invalid-token',
  NOT_IN_MATCH: 'not-in-match',
  ALREADY_IN_MATCH: 'already-in-match',
  /** Комната удалена: никто не занял второе место слишком долго. */
  EXPIRED: 'expired',
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
  /** Имена игроков по номеру места (PlayerId). */
  names: [string, string]
  /** Почему партия закончилась; null, пока она идёт. */
  endReason: EndReason | null
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

export interface OpponentStatusMessage {
  type: typeof SERVER_MESSAGE.OPPONENT_STATUS
  connected: boolean
  /** Сколько мс до автоматической сдачи отключившегося соперника; null, пока он на связи или партия не идёт. */
  reconnectTimeLeftMs: number | null
}

export interface SearchStatusMessage {
  type: typeof SERVER_MESSAGE.SEARCH_STATUS
  searching: boolean
}

export interface RematchStatusMessage {
  type: typeof SERVER_MESSAGE.REMATCH_STATUS
  /** Вы предложили реванш. */
  you: boolean
  /** Соперник предложил реванш. */
  opponent: boolean
  /** Реванш ещё возможен: соперник на месте (не ушёл из матча и не отключился). */
  available: boolean
}

export interface ErrorMessage {
  type: typeof SERVER_MESSAGE.ERROR
  reason: MatchError
}

export type ServerMessage
  = | AckMessage
    | ErrorMessage
    | JoinedMessage
    | OpponentStatusMessage
    | RejectMessage
    | RematchStatusMessage
    | SearchStatusMessage
    | UpdateMessage
