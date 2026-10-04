import type { PlayedCard, PlayerView } from '@space/engine'
import type { TableState } from './types'

function copyPlayed(entry: PlayedCard): PlayedCard {
  return { card: { ...entry.card }, used: { ...entry.used }, ...(entry.copyOf ? { copyOf: entry.copyOf } : {}) }
}

/** Стол по снимку состояния от сервера. Данные копируются: view приходит из реактивного состояния подключения. */
export function buildTable(view: PlayerView): TableState {
  return {
    you: view.you,
    currentPlayer: view.currentPlayer,
    turn: view.turn,
    winner: view.winner,
    pools: { ...view.pools },
    self: {
      authority: view.self.authority,
      deckCount: view.self.deckCount,
      handCount: view.self.hand.length,
      hand: view.self.hand.map(card => ({ ...card })),
      deckContents: { ...view.self.deckContents },
      discard: view.self.discard.map(card => ({ ...card })),
      inPlay: view.self.inPlay.map(copyPlayed),
    },
    opponent: {
      authority: view.opponent.authority,
      deckCount: view.opponent.deckCount,
      handCount: view.opponent.handCount,
      hand: [],
      deckContents: null,
      discard: view.opponent.discard.map(card => ({ ...card })),
      inPlay: view.opponent.inPlay.map(copyPlayed),
    },
    tradeRow: view.tradeRow.map(card => (card ? { ...card } : null)),
    tradeDeckCount: view.tradeDeckCount,
    explorersCount: view.explorersCount,
    scrapHeap: view.scrapHeap.map(card => ({ ...card })),
    prompt: view.prompt ? JSON.parse(JSON.stringify(view.prompt)) : null,
  }
}
