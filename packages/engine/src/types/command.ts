import type { AbilityKind, COMMAND_TYPE, CommandError } from './constants.ts'
import type { GameEvent } from './event.ts'
import type { GameState } from './state.ts'

export type Command
  = | { type: typeof COMMAND_TYPE.PLAY_CARD, cardId: string }
    | { type: typeof COMMAND_TYPE.BUY, cardId: string }
    | { type: typeof COMMAND_TYPE.BUY_EXPLORER }
    | { type: typeof COMMAND_TYPE.ACTIVATE, cardId: string, ability: AbilityKind }
    | { type: typeof COMMAND_TYPE.ATTACK_PLAYER, amount: number }
    | { type: typeof COMMAND_TYPE.ATTACK_BASE, cardId: string }
    | { type: typeof COMMAND_TYPE.CHOOSE_OPTION, promptId: number, index: number }
    | { type: typeof COMMAND_TYPE.CHOOSE_CARD, promptId: number, cardId: string }
    | { type: typeof COMMAND_TYPE.CHOOSE_CARDS, promptId: number, cardIds: string[] }
    | { type: typeof COMMAND_TYPE.SKIP, promptId: number }
    | { type: typeof COMMAND_TYPE.END_TURN }
    | { type: typeof COMMAND_TYPE.CONCEDE }

export type ApplyResult
  = | { ok: true, state: GameState, events: GameEvent[] }
    | { ok: false, error: CommandError }
