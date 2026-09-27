import type { CardInstance, GameState, PlayerState } from '../types/index.ts'
import {
  EXPLORER_COUNT,
  FIRST_PLAYER_STARTING_HAND,
  HAND_SIZE,
  STARTING_AUTHORITY,
  STARTING_DECK,
  TRADE_DECK_COMPOSITION,
  TRADE_ROW_SIZE,
} from '../data/config.ts'
import { createRng } from '../lib/rng.ts'
import { emptyPools } from './effects.ts'

/**
 * Создаёт новую партию. Идентификаторы карт присваиваются до перемешивания,
 * поэтому по id нельзя узнать порядок скрытых карт.
 */
export function createGame(seed: number): GameState {
  const rng = createRng(seed)
  let counter = 0
  const make = (cardId: string): CardInstance => ({ id: `c${counter++}`, cardId })
  const makeMany = (composition: Readonly<Record<string, number>>): CardInstance[] =>
    Object.entries(composition).flatMap(([cardId, count]) => Array.from({ length: count }, () => make(cardId)))

  const makePlayer = (): PlayerState => ({
    authority: STARTING_AUTHORITY,
    deck: rng.shuffle(makeMany(STARTING_DECK)),
    hand: [],
    discard: [],
    inPlay: [],
  })

  const players: [PlayerState, PlayerState] = [makePlayer(), makePlayer()]
  const explorers = Array.from({ length: EXPLORER_COUNT }, () => make('explorer'))
  const tradeDeck = rng.shuffle(makeMany(TRADE_DECK_COMPOSITION))
  const tradeRow = tradeDeck.splice(0, TRADE_ROW_SIZE)

  players[0].hand = players[0].deck.splice(0, FIRST_PLAYER_STARTING_HAND)
  players[1].hand = players[1].deck.splice(0, HAND_SIZE)

  return {
    version: 0,
    rngState: rng.state(),
    promptCounter: 0,
    players,
    currentPlayer: 0,
    turn: 1,
    pools: emptyPools(),
    tradeDeck,
    tradeRow,
    explorers,
    scrapHeap: [],
    prompt: null,
    continuation: [],
    winner: null,
  }
}
