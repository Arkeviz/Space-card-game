import type { Command } from '@space/engine'
import { ABILITY_KIND, COMMAND_TYPE } from '@space/engine'
import * as z from 'zod'

/** id экземпляра карты (`c0`, `c117`): предел с большим запасом, длиннее не бывает. */
const cardId = z.string().min(1).max(32)
/** Первый prompt в партии получает id 1 (счётчик увеличивается до присвоения), 0 никогда не бывает валиден. */
const promptId = z.number().int().min(1)
const abilityKind = z.enum([ABILITY_KIND.BASIC, ABILITY_KIND.ALLY, ABILITY_KIND.SCRAP])

/** Схема команды игрока. Зеркалит Command из @space/engine - при расхождении typecheck укажет на несоответствие. */
export const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(COMMAND_TYPE.PLAY_CARD), cardId }),
  z.object({ type: z.literal(COMMAND_TYPE.BUY), cardId }),
  z.object({ type: z.literal(COMMAND_TYPE.BUY_EXPLORER) }),
  z.object({ type: z.literal(COMMAND_TYPE.ACTIVATE), cardId, ability: abilityKind }),
  z.object({ type: z.literal(COMMAND_TYPE.ATTACK_PLAYER), amount: z.number().int().min(1) }),
  z.object({ type: z.literal(COMMAND_TYPE.ATTACK_BASE), cardId }),
  z.object({ type: z.literal(COMMAND_TYPE.CHOOSE_OPTION), promptId, index: z.number().int().min(0) }),
  z.object({ type: z.literal(COMMAND_TYPE.CHOOSE_CARD), promptId, cardId }),
  z.object({ type: z.literal(COMMAND_TYPE.CHOOSE_CARDS), promptId, cardIds: z.array(cardId).min(1).max(20) }),
  z.object({ type: z.literal(COMMAND_TYPE.SKIP), promptId }),
  z.object({ type: z.literal(COMMAND_TYPE.END_TURN) }),
  z.object({ type: z.literal(COMMAND_TYPE.CONCEDE) }),
])

/** Проверяет и приводит произвольные данные к Command. Возвращает null, если форма не совпала. */
export function parseCommand(data: unknown): Command | null {
  const result = CommandSchema.safeParse(data)
  return result.success ? (result.data as Command) : null
}
