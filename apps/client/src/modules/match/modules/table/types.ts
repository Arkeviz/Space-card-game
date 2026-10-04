import type { CardInstance, PlayedCard, PlayerId, Pools, Prompt, ValueOf } from '@space/engine'

/** Сторона стола относительно этого клиента: «я» всегда внизу, соперник вверху. */
export const SIDE = {
  SELF: 'self',
  OPPONENT: 'opponent',
} as const
export type Side = ValueOf<typeof SIDE>

export interface TableSide {
  authority: number
  deckCount: number
  /** Число карт в руке. Для себя совпадает с hand.length, для соперника известно только оно. */
  handCount: number
  /** Состав руки: только у себя, у соперника всегда пусто. */
  hand: CardInstance[]
  /** Состав колоды (cardId -> сколько): только у себя, без порядка; у соперника null. */
  deckContents: Record<string, number> | null
  /** Сброс виден обоим игрокам; последняя карта - верхняя. */
  discard: CardInstance[]
  inPlay: PlayedCard[]
}

/**
 * Что сейчас нарисовано на столе (renderedView). Строится из PlayerView и меняется по событиям, поэтому
 * между update'ами сервера может отставать от серверного состояния - ровно на время анимации.
 */
export interface TableState {
  you: PlayerId
  currentPlayer: PlayerId
  turn: number
  winner: PlayerId | null
  pools: Pools
  self: TableSide
  opponent: TableSide
  tradeRow: (CardInstance | null)[]
  tradeDeckCount: number
  explorersCount: number
  scrapHeap: CardInstance[]
  prompt: Prompt | null
}
