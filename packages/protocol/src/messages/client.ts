import * as z from 'zod'
import { CommandSchema } from './command.ts'

export const CLIENT_MESSAGE = {
  /** Создать новый матч. Сервер отвечает JOINED с кодом для второго игрока. */
  CREATE_MATCH: 'create-match',
  /** Войти в матч по коду, полученному от первого игрока. */
  JOIN_MATCH: 'join-match',
  /** Встать в очередь быстрого поиска: сервер сведёт с первым же ждущим соперником. */
  FIND_MATCH: 'find-match',
  /** Выйти из очереди быстрого поиска. */
  CANCEL_SEARCH: 'cancel-search',
  /** Переподключиться к своему месту в матче после разрыва соединения. */
  RECONNECT: 'reconnect',
  /** Покинуть матч: в ожидании соперника комната закрывается, в идущей партии засчитывается сдача. */
  LEAVE_MATCH: 'leave-match',
  /** Предложить реванш после конца партии (или принять предложение соперника). */
  REMATCH: 'rematch',
  /** Команда игрока с client-side id для идемпотентности (ACK/REJECT ссылаются на него). */
  COMMAND: 'command',
  /** Запросить полный снимок состояния без анимаций. */
  SYNC: 'sync',
} as const

/** Максимальная длина имени игрока (клиент берёт её для maxlength поля ввода). */
export const PLAYER_NAME_MAX_LENGTH = 20

const nonEmptyString = z.string().min(1)

/** Имя игрока: без пробелов по краям, 1..PLAYER_NAME_MAX_LENGTH символов, без управляющих и невидимых символов. */
const PlayerNameSchema = z.string()
  .trim()
  .min(1)
  .max(PLAYER_NAME_MAX_LENGTH)
  .regex(/^\P{C}+$/u)

const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(CLIENT_MESSAGE.CREATE_MATCH), name: PlayerNameSchema }),
  z.object({ type: z.literal(CLIENT_MESSAGE.JOIN_MATCH), code: nonEmptyString, name: PlayerNameSchema }),
  z.object({ type: z.literal(CLIENT_MESSAGE.FIND_MATCH), name: PlayerNameSchema }),
  z.object({ type: z.literal(CLIENT_MESSAGE.CANCEL_SEARCH) }),
  z.object({ type: z.literal(CLIENT_MESSAGE.RECONNECT), matchId: nonEmptyString, token: nonEmptyString }),
  z.object({ type: z.literal(CLIENT_MESSAGE.LEAVE_MATCH) }),
  z.object({ type: z.literal(CLIENT_MESSAGE.REMATCH) }),
  z.object({ type: z.literal(CLIENT_MESSAGE.COMMAND), commandId: nonEmptyString, command: CommandSchema }),
  z.object({ type: z.literal(CLIENT_MESSAGE.SYNC) }),
])

export type ClientMessage = z.output<typeof ClientMessageSchema>

/** Разбирает и проверяет сырой текст WS-сообщения от клиента. null - невалидный JSON или форма не совпала. */
export function parseClientMessage(raw: string): ClientMessage | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  }
  catch {
    return null
  }
  const result = ClientMessageSchema.safeParse(data)
  return result.success ? result.data : null
}
