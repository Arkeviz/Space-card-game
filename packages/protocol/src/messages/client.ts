import * as v from 'valibot'
import { CommandSchema } from './command.ts'

export const CLIENT_MESSAGE = {
  /** Создать новый матч. Сервер отвечает JOINED с кодом для второго игрока. */
  CREATE_MATCH: 'create-match',
  /** Войти в матч по коду, полученному от первого игрока. */
  JOIN_MATCH: 'join-match',
  /** Переподключиться к своему месту в матче после разрыва соединения. */
  RECONNECT: 'reconnect',
  /** Команда игрока с client-side id для идемпотентности (ACK/REJECT ссылаются на него). */
  COMMAND: 'command',
  /** Запросить полный снимок состояния без анимаций. */
  SYNC: 'sync',
} as const

const nonEmptyString = v.pipe(v.string(), v.minLength(1))

const ClientMessageSchema = v.variant('type', [
  v.object({ type: v.literal(CLIENT_MESSAGE.CREATE_MATCH) }),
  v.object({ type: v.literal(CLIENT_MESSAGE.JOIN_MATCH), code: nonEmptyString }),
  v.object({ type: v.literal(CLIENT_MESSAGE.RECONNECT), matchId: nonEmptyString, token: nonEmptyString }),
  v.object({ type: v.literal(CLIENT_MESSAGE.COMMAND), commandId: nonEmptyString, command: CommandSchema }),
  v.object({ type: v.literal(CLIENT_MESSAGE.SYNC) }),
])

export type ClientMessage = v.InferOutput<typeof ClientMessageSchema>

/** Разбирает и проверяет сырой текст WS-сообщения от клиента. null - невалидный JSON или форма не совпала. */
export function parseClientMessage(raw: string): ClientMessage | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  }
  catch {
    return null
  }
  const result = v.safeParse(ClientMessageSchema, data)
  return result.success ? result.output : null
}
