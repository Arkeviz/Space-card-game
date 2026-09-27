import type { CardInstance, Command, CommandError, GameEvent, GameState, PlayerId } from '../types/index.ts'
import { apply } from '../game/apply.ts'
import { freshUsage } from '../game/effects.ts'
import { createGame } from '../game/setup.ts'

let counter = 0

/** Новая карта с уникальным id, не пересекающимся с id из createGame. */
export function inst(cardId: string): CardInstance {
  counter += 1
  return { id: `t${counter}`, cardId }
}

/** Партия с фиксированным сидом. У игрока 0 в руке 3 карты, у игрока 1 - 5. */
export function newGame(seed = 1): GameState {
  return createGame(seed)
}

type Instances<T extends readonly string[]> = { [K in keyof T]: CardInstance }

function make<const T extends readonly string[]>(cardIds: T): Instances<T> {
  return cardIds.map(cardId => inst(cardId)) as unknown as Instances<T>
}

/** Подменяет руку игрока и возвращает созданные карты в том же порядке. */
export function setHand<const T extends readonly string[]>(state: GameState, player: PlayerId, cardIds: T): Instances<T> {
  const cards = make(cardIds)
  state.players[player].hand = [...cards]
  return cards
}

/** Кладёт карты прямо на стол игрока (например, базы, оставшиеся с прошлых ходов). */
export function setInPlay<const T extends readonly string[]>(state: GameState, player: PlayerId, cardIds: T): Instances<T> {
  const cards = make(cardIds)
  state.players[player].inPlay = cards.map(card => ({ card, used: freshUsage() }))
  return cards
}

export function setRow<const T extends readonly string[]>(state: GameState, cardIds: T): Instances<T> {
  const cards = make(cardIds)
  state.tradeRow = [...cards]
  return cards
}

export function run(state: GameState, player: PlayerId, command: Command): { state: GameState, events: GameEvent[] } {
  const result = apply(state, player, command)
  if (!result.ok)
    throw new Error(`Команда ${command.type} отклонена: ${result.error}`)
  return { state: result.state, events: result.events }
}

export function errorOf(state: GameState, player: PlayerId, command: Command): CommandError {
  const result = apply(state, player, command)
  if (result.ok)
    throw new Error(`Команда ${command.type} неожиданно принята`)
  return result.error
}
