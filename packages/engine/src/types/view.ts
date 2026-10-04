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
  self: PublicPlayerView & {
    hand: CardInstance[]
    /**
     * Состав своей колоды: cardId -> сколько таких карт в ней, ключи по алфавиту. Игрок знает, какие карты у него
     * в колоде, но не знает их порядок: порядка и id экземпляров здесь нет.
     */
    deckContents: Record<string, number>
  }
  opponent: PublicPlayerView & { handCount: number }
  tradeRow: (CardInstance | null)[]
  tradeDeckCount: number
  explorersCount: number
  scrapHeap: CardInstance[]
  prompt: Prompt | null
}
