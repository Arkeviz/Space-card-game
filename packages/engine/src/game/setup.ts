import type { CardInstance, GameState, PlayerId, PlayerState } from '../types/index.ts'
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

export interface CreateGameOptions {
  /** Кто ходит первым. По умолчанию выбирается случайно из сида (тот же сид - тот же первый игрок). */
  firstPlayer?: PlayerId
}

/**
 * Создаёт новую партию. Идентификаторы карт присваиваются до перемешивания,
 * поэтому по id нельзя узнать порядок скрытых карт. Первый игрок берёт меньше карт (FIRST_PLAYER_STARTING_HAND).
 */
export function createGame(seed: number, options: CreateGameOptions = {}): GameState {
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

  // Бросок делается всегда, даже если первый игрок задан явно: так состояние генератора не зависит от options.
  const drawn: PlayerId = rng.int(2) === 0 ? 0 : 1
  const firstPlayer = options.firstPlayer ?? drawn
  const secondPlayer: PlayerId = firstPlayer === 0 ? 1 : 0
  players[firstPlayer].hand = players[firstPlayer].deck.splice(0, FIRST_PLAYER_STARTING_HAND)
  players[secondPlayer].hand = players[secondPlayer].deck.splice(0, HAND_SIZE)

  return {
    version: 0,
    rngState: rng.state(),
    promptCounter: 0,
    players,
    currentPlayer: firstPlayer,
    turn: 1,
    pools: emptyPools(),
    tradeDeck,
    tradeRow,
    explorers,
    scrapHeap: [],
    nextShipToDeckTop: false,
    pendingDiscards: [0, 0],
    playedThisTurn: [],
    prompt: null,
    continuation: [],
    winner: null,
  }
}
