import type { GameEvent, GameState, PlayerId, PlayerView } from '../types/index.ts'
import { EVENT_TYPE } from '../types/index.ts'
import { other } from './effects.ts'

/** Состав колоды без порядка: ключи отсортированы, иначе порядок первых появлений выдал бы порядок колоды. */
function deckContents(deck: readonly { cardId: string }[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const { cardId } of deck)
    counts[cardId] = (counts[cardId] ?? 0) + 1
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}

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
      deckContents: deckContents(me.deck),
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
