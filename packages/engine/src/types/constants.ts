/*
 * Все строковые «перечисления» движка. Значения используются и как типы, и как runtime-значения:
 * менять текст достаточно здесь. Enum не используем (erasableSyntaxOnly), поэтому as const + typeof.
 */

export type ValueOf<T> = T[keyof T]

export const FACTION = {
  NEUTRAL: 'neutral',
  TRADE_FEDERATION: 'trade-federation',
  BLOB: 'blob',
  MACHINE_CULT: 'machine-cult',
  STAR_EMPIRE: 'star-empire',
} as const
export type Faction = ValueOf<typeof FACTION>

export const CARD_KIND = {
  SHIP: 'ship',
  BASE: 'base',
  OUTPOST: 'outpost',
} as const
export type CardKind = ValueOf<typeof CARD_KIND>

export const ABILITY_KIND = {
  BASIC: 'basic',
  ALLY: 'ally',
  SCRAP: 'scrap',
} as const
export type AbilityKind = ValueOf<typeof ABILITY_KIND>

export const RESOURCE = {
  TRADE: 'trade',
  COMBAT: 'combat',
  AUTHORITY: 'authority',
} as const
export type Resource = ValueOf<typeof RESOURCE>

export const SCRAP_ZONE = {
  HAND: 'hand',
  DISCARD: 'discard',
  TRADE_ROW: 'trade-row',
} as const
export type ScrapZone = ValueOf<typeof SCRAP_ZONE>

export const EFFECT_TYPE = {
  GAIN: 'gain',
  DRAW: 'draw',
  OPPONENT_DISCARD: 'opponent-discard',
  SCRAP: 'scrap',
  CHOICE: 'choice',
} as const
export type EffectType = ValueOf<typeof EFFECT_TYPE>

export const PROMPT_KIND = {
  CHOICE: 'choice',
  DISCARD: 'discard',
  SCRAP: 'scrap',
} as const
export type PromptKind = ValueOf<typeof PROMPT_KIND>

export const COMMAND_TYPE = {
  PLAY_CARD: 'PLAY_CARD',
  BUY: 'BUY',
  BUY_EXPLORER: 'BUY_EXPLORER',
  ACTIVATE: 'ACTIVATE',
  ATTACK_PLAYER: 'ATTACK_PLAYER',
  ATTACK_BASE: 'ATTACK_BASE',
  CHOOSE_OPTION: 'CHOOSE_OPTION',
  CHOOSE_CARD: 'CHOOSE_CARD',
  SKIP: 'SKIP',
  END_TURN: 'END_TURN',
} as const
export type CommandType = ValueOf<typeof COMMAND_TYPE>

export const COMMAND_ERROR = {
  GAME_OVER: 'game-over',
  NOT_YOUR_TURN: 'not-your-turn',
  PROMPT_PENDING: 'prompt-pending',
  NO_PROMPT: 'no-prompt',
  WRONG_PROMPT: 'wrong-prompt',
  CARD_NOT_FOUND: 'card-not-found',
  CANNOT_AFFORD: 'cannot-afford',
  ABILITY_UNAVAILABLE: 'ability-unavailable',
  ABILITY_USED: 'ability-used',
  INVALID_CHOICE: 'invalid-choice',
  INVALID_AMOUNT: 'invalid-amount',
  OUTPOST_BLOCKS: 'outpost-blocks',
  INSUFFICIENT_COMBAT: 'insufficient-combat',
} as const
export type CommandError = ValueOf<typeof COMMAND_ERROR>

export const EVENT_TYPE = {
  DECK_SHUFFLED: 'deck-shuffled',
  CARDS_DRAWN: 'cards-drawn',
  CARD_PLAYED: 'card-played',
  CARD_BOUGHT: 'card-bought',
  TRADE_ROW_REFILLED: 'trade-row-refilled',
  ABILITY_ACTIVATED: 'ability-activated',
  RESOURCE_GAINED: 'resource-gained',
  RESOURCE_SPENT: 'resource-spent',
  PLAYER_ATTACKED: 'player-attacked',
  BASE_DESTROYED: 'base-destroyed',
  CARD_DISCARDED: 'card-discarded',
  CARD_SCRAPPED: 'card-scrapped',
  PROMPT_OPENED: 'prompt-opened',
  PROMPT_RESOLVED: 'prompt-resolved',
  TURN_ENDED: 'turn-ended',
  TURN_STARTED: 'turn-started',
  GAME_OVER: 'game-over',
} as const
export type EventType = ValueOf<typeof EVENT_TYPE>

/** Ресурсы, которые копятся в пуле хода (авторитет хранится у игрока). */
export type SpendableResource = Exclude<Resource, typeof RESOURCE.AUTHORITY>
/** Способности, у которых есть флаг «использовано» (утилизация карту убирает, флаг не нужен). */
export type UsableAbility = Exclude<AbilityKind, typeof ABILITY_KIND.SCRAP>
