import type { CardInstance } from './card.ts'
import type { PlayedCard, PlayerId, Pools, Prompt } from './state.ts'

export interface PublicPlayerView {
  authority: number
  deckCount: number
  /** Сброс лежит лицом вверх и виден обоим. */
  discard: CardInstance[]
  inPlay: PlayedCard[]
}

/** Снимок состояния для одного игрока: без скрытой информации. */
export interface PlayerView {
  version: number
  you: PlayerId
  currentPlayer: PlayerId
  turn: number
  winner: PlayerId | null
  pools: Pools
  self: PublicPlayerView & { hand: CardInstance[] }
  opponent: PublicPlayerView & { handCount: number }
  tradeRow: (CardInstance | null)[]
  tradeDeckCount: number
  explorersCount: number
  scrapHeap: CardInstance[]
  prompt: Prompt | null
}
