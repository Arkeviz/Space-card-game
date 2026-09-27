import type { Command } from '@space/engine'
import { ABILITY_KIND, COMMAND_TYPE } from '@space/engine'
import * as v from 'valibot'

const cardId = v.pipe(v.string(), v.minLength(1))
/** Первый prompt в партии получает id 1 (счётчик увеличивается до присвоения), 0 никогда не бывает валиден. */
const promptId = v.pipe(v.number(), v.integer(), v.minValue(1))
const abilityKind = v.picklist([ABILITY_KIND.BASIC, ABILITY_KIND.ALLY, ABILITY_KIND.SCRAP])

/** Схема команды игрока. Зеркалит Command из @space/engine - при расхождении typecheck укажет на несоответствие. */
export const CommandSchema = v.variant('type', [
  v.object({ type: v.literal(COMMAND_TYPE.PLAY_CARD), cardId }),
  v.object({ type: v.literal(COMMAND_TYPE.BUY), cardId }),
  v.object({ type: v.literal(COMMAND_TYPE.BUY_EXPLORER) }),
  v.object({ type: v.literal(COMMAND_TYPE.ACTIVATE), cardId, ability: abilityKind }),
  v.object({ type: v.literal(COMMAND_TYPE.ATTACK_PLAYER), amount: v.pipe(v.number(), v.integer(), v.minValue(1)) }),
  v.object({ type: v.literal(COMMAND_TYPE.ATTACK_BASE), cardId }),
  v.object({ type: v.literal(COMMAND_TYPE.CHOOSE_OPTION), promptId, index: v.pipe(v.number(), v.integer(), v.minValue(0)) }),
  v.object({ type: v.literal(COMMAND_TYPE.CHOOSE_CARD), promptId, cardId }),
  v.object({ type: v.literal(COMMAND_TYPE.SKIP), promptId }),
  v.object({ type: v.literal(COMMAND_TYPE.END_TURN) }),
  v.object({ type: v.literal(COMMAND_TYPE.FORFEIT) }),
])

/** Проверяет и приводит произвольные данные к Command. Возвращает null, если форма не совпала. */
export function parseCommand(data: unknown): Command | null {
  const result = v.safeParse(CommandSchema, data)
  return result.success ? (result.output as Command) : null
}
