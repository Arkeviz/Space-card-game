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
  /** Уничтожить базу или аванпост соперника без затрат атаки. */
  DESTROY_BASE: 'destroy-base',
  /** Получить любой корабль (из ряда или исследователя) бесплатно и положить на верх своей колоды. */
  ACQUIRE_SHIP: 'acquire-ship',
  /** Следующий корабль, полученный в этот ход, кладётся на верх колоды вместо сброса. */
  SHIP_TO_DECK_TOP: 'ship-to-deck-top',
  /** Взять карты, если в игре достаточно баз. */
  DRAW_IF_BASES: 'draw-if-bases',
  /** Взять по карте за каждую карту фракции, сыгранную в этот ход. */
  DRAW_PER_PLAYED: 'draw-per-played',
  /** Сбросить из руки до N карт и взять столько же. */
  DISCARD_DRAW: 'discard-draw',
  /** Скопировать другой корабль, сыгранный в этот ход. */
  COPY_SHIP: 'copy-ship',
} as const
export type EffectType = ValueOf<typeof EFFECT_TYPE>

export const PROMPT_KIND = {
  CHOICE: 'choice',
  DISCARD: 'discard',
  SCRAP: 'scrap',
  DESTROY_BASE: 'destroy-base',
  ACQUIRE_SHIP: 'acquire-ship',
  COPY_SHIP: 'copy-ship',
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
  /** Сдаться («concede»). Работает независимо от того, чей сейчас ход или открыт ли prompt (в отличие от всех остальных команд). */
  CONCEDE: 'CONCEDE',
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
  CARD_ACQUIRED: 'card-acquired',
  SHIP_COPIED: 'ship-copied',
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

/** Куда попадает купленная карта: обычно в сброс, а при SHIP_TO_DECK_TOP - на верх колоды. */
export const DESTINATION = {
  DISCARD: 'discard',
  DECK_TOP: 'deck-top',
} as const
export type Destination = ValueOf<typeof DESTINATION>

/** Постоянные свойства карт на столе (не способности: их не нужно активировать). */
export const PASSIVE_TYPE = {
  /** Считается союзником для всех фракций. */
  ALL_FACTIONS: 'all-factions',
  /** Каждый сыгранный корабль даёт дополнительную атаку. */
  SHIP_COMBAT_BONUS: 'ship-combat-bonus',
} as const
export type PassiveType = ValueOf<typeof PASSIVE_TYPE>

/** Ресурсы, которые копятся в пуле хода (авторитет хранится у игрока). */
export type SpendableResource = Exclude<Resource, typeof RESOURCE.AUTHORITY>
/** Способности, у которых есть флаг «использовано» (утилизация карту убирает, флаг не нужен). */
export type UsableAbility = Exclude<AbilityKind, typeof ABILITY_KIND.SCRAP>
