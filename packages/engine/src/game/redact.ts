import type { GameEvent, GameState, PlayerId, PlayerView } from '../types/index.ts'
import { EVENT_TYPE } from '../types/index.ts'
import { other } from './effects.ts'

/**
 * Снимок состояния для одного игрока. Не содержит скрытой информации:
 * ни порядка и состава колод, ни руки соперника, ни состояния генератора случайных чисел.
 */
export function redact(state: GameState, viewer: PlayerId): PlayerView {
  const me = state.players[viewer]
  const opponent = state.players[other(viewer)]

  return {
    version: state.version,
    you: viewer,
    currentPlayer: state.currentPlayer,
    turn: state.turn,
    winner: state.winner,
    pools: { ...state.pools },
    self: {
      authority: me.authority,
      deckCount: me.deck.length,
      discard: me.discard,
      inPlay: me.inPlay,
      hand: me.hand,
    },
    opponent: {
      authority: opponent.authority,
      deckCount: opponent.deck.length,
      discard: opponent.discard,
      inPlay: opponent.inPlay,
      handCount: opponent.hand.length,
    },
    tradeRow: state.tradeRow,
    tradeDeckCount: state.tradeDeck.length,
    explorersCount: state.explorers.length,
    scrapHeap: state.scrapHeap,
    prompt: state.prompt,
  }
}

/** Убирает из событий то, что viewer видеть не должен (карты, взятые соперником). */
export function redactEvents(events: readonly GameEvent[], viewer: PlayerId): GameEvent[] {
  return events.map((event) => {
    if (event.type === EVENT_TYPE.CARDS_DRAWN && event.player !== viewer)
      return { type: EVENT_TYPE.CARDS_DRAWN, player: event.player, count: event.count }
    return event
  })
}
