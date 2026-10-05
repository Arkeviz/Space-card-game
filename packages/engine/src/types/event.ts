import type { CardInstance } from './card.ts'
import type { AbilityKind, Destination, EVENT_TYPE, Resource, ScrapZone, SpendableResource } from './constants.ts'
import type { PlayerId, Prompt } from './state.ts'

/** Полное событие, как его видит сервер. Скрытые данные вычищает redactEvents. */
export type GameEvent
  = | { type: typeof EVENT_TYPE.DECK_SHUFFLED, player: PlayerId, count: number }
  /** cards есть только в полном событии и у владельца руки. */
    | { type: typeof EVENT_TYPE.CARDS_DRAWN, player: PlayerId, count: number, cards?: CardInstance[] }
    | { type: typeof EVENT_TYPE.CARD_PLAYED, player: PlayerId, card: CardInstance }
    | { type: typeof EVENT_TYPE.CARD_BOUGHT, player: PlayerId, card: CardInstance, from: 'trade-row' | 'explorers', slot: number | null, to: Destination }
  /** Корабль получен бесплатно и лёг на верх колоды (Blob Carrier). */
    | { type: typeof EVENT_TYPE.CARD_ACQUIRED, player: PlayerId, card: CardInstance, from: 'trade-row' | 'explorers', slot: number | null }
  /** Игрок обязан сбросить amount карт в начале своего хода (эффект «соперник сбрасывает»). */
    | { type: typeof EVENT_TYPE.DISCARD_QUEUED, player: PlayerId, amount: number }
  /** Карта на столе скопировала другой корабль (Stealth Needle). */
    | { type: typeof EVENT_TYPE.SHIP_COPIED, player: PlayerId, cardId: string, copyOf: string }
    | { type: typeof EVENT_TYPE.TRADE_ROW_REFILLED, slot: number, card: CardInstance }
    | { type: typeof EVENT_TYPE.ABILITY_ACTIVATED, player: PlayerId, cardId: string, ability: AbilityKind }
    | { type: typeof EVENT_TYPE.RESOURCE_GAINED, player: PlayerId, resource: Resource, amount: number }
    | { type: typeof EVENT_TYPE.RESOURCE_SPENT, player: PlayerId, resource: SpendableResource, amount: number }
    | { type: typeof EVENT_TYPE.PLAYER_ATTACKED, attacker: PlayerId, target: PlayerId, amount: number }
    | { type: typeof EVENT_TYPE.BASE_DESTROYED, owner: PlayerId, card: CardInstance }
    | { type: typeof EVENT_TYPE.CARD_DISCARDED, player: PlayerId, card: CardInstance, from: 'hand' | 'play' }
    | { type: typeof EVENT_TYPE.CARD_SCRAPPED, player: PlayerId, card: CardInstance, from: ScrapZone | 'play' }
    | { type: typeof EVENT_TYPE.PROMPT_OPENED, prompt: Prompt }
    | { type: typeof EVENT_TYPE.PROMPT_RESOLVED, promptId: number }
    | { type: typeof EVENT_TYPE.TURN_ENDED, player: PlayerId }
    | { type: typeof EVENT_TYPE.TURN_STARTED, player: PlayerId, turn: number }
    | { type: typeof EVENT_TYPE.GAME_OVER, winner: PlayerId }
