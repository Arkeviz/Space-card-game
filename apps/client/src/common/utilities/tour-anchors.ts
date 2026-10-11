/*
 * Якоря для подсказок обучения: на какие места экрана матча могут указывать окна тура. Экран матча помечает свои
 * элементы атрибутом data-tour (см. tourAnchor), обучение находит их по селектору. Так модули не знают друг о друге,
 * а договариваются только об этих именах.
 */
export const TOUR_ANCHOR = {
  OPPONENT_PANEL: 'opponent-panel',
  SELF_PANEL: 'self-panel',
  TURN_PANEL: 'turn-panel',
  POOLS: 'pools',
  PLAY_ALL: 'play-all',
  ATTACK: 'attack',
  END_TURN: 'end-turn',
  LOG: 'log',
  HAND: 'hand',
  TRADE_ROW: 'trade-row',
  EXPLORERS: 'explorers',
  SELF_PILES: 'self-piles',
  OPPONENT_FIELD: 'opponent-field',
  SELF_FIELD: 'self-field',
} as const
export type TourAnchor = (typeof TOUR_ANCHOR)[keyof typeof TOUR_ANCHOR]

/** Атрибуты для разметки: `v-bind="tourAnchor(TOUR_ANCHOR.POOLS)"`. */
export function tourAnchor(anchor: TourAnchor): { 'data-tour': TourAnchor } {
  return { 'data-tour': anchor }
}

/** CSS-селектор якоря. */
export function anchorSelector(anchor: TourAnchor): string {
  return `[data-tour="${anchor}"]`
}

/** CSS-селектор карты на столе по id экземпляра (узлы слоя карт подписаны data-key). */
export function cardSelector(instanceId: string): string {
  return `[data-key="${instanceId}"]`
}

/** Окно (запрос выбора, справка): модальные окна игры. */
export const DIALOG_SELECTOR = '[role="dialog"][aria-modal="true"]'
