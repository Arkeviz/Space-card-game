import type { AbilityKind, CardInstance, Command, GameState, PlayerId } from '@space/engine'
import type { Matcher, Move } from './lesson-types'
import { ABILITY_KIND, COMMAND_TYPE } from '@space/engine'

/** Все карты партии, лежащие в открытых или личных зонах игрока и на рынке. */
function allCards(state: GameState): CardInstance[] {
  const cards: CardInstance[] = []
  for (const player of state.players)
    cards.push(...player.hand, ...player.inPlay.map(entry => entry.card), ...player.discard)
  cards.push(...state.tradeRow.filter(card => card !== null), ...state.explorers)
  return cards
}

/** cardId экземпляра по его id; null, если такой карты нет на столе. */
export function cardIdOf(state: GameState, instanceId: string): string | null {
  return allCards(state).find(card => card.id === instanceId)?.cardId ?? null
}

export function findInHand(state: GameState, player: PlayerId, cardId: string): CardInstance | undefined {
  return state.players[player].hand.find(card => card.cardId === cardId)
}

export function findInRow(state: GameState, cardId: string): CardInstance | undefined {
  return state.tradeRow.find(card => card?.cardId === cardId) ?? undefined
}

export function findInPlay(state: GameState, player: PlayerId, cardId: string): CardInstance | undefined {
  return state.players[player].inPlay.find(entry => entry.card.cardId === cardId)?.card
}

/* ---------- Что разрешено игроку ---------- */

/** Разыграть карту любого из перечисленных видов; без списка - любую. */
export function playing(...cardIds: string[]): Matcher {
  return (command, state) =>
    command.type === COMMAND_TYPE.PLAY_CARD && (cardIds.length === 0 || cardIds.includes(cardIdOf(state, command.cardId) ?? ''))
}

export function buying(cardId: string): Matcher {
  return (command, state) =>
    command.type === COMMAND_TYPE.BUY && cardIdOf(state, command.cardId) === cardId
}

export function activating(cardId: string, ability: AbilityKind = ABILITY_KIND.BASIC): Matcher {
  return (command, state) =>
    command.type === COMMAND_TYPE.ACTIVATE && command.ability === ability && cardIdOf(state, command.cardId) === cardId
}

export const commandOf = (type: Command['type']): Matcher => command => command.type === type

/* ---------- Записанные ходы соперника ---------- */

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined)
    throw new Error(`Сценарий обучения: ${what} не найдено`)
  return value
}

export function play(cardId: string): Move {
  return state => ({
    type: COMMAND_TYPE.PLAY_CARD,
    cardId: required(findInHand(state, 1, cardId), `карты «${cardId}» в руке соперника`).id,
  })
}

export function buy(cardId: string): Move {
  return state => ({
    type: COMMAND_TYPE.BUY,
    cardId: required(findInRow(state, cardId), `карты «${cardId}» на рынке`).id,
  })
}

export const buyExplorer: Move = () => ({ type: COMMAND_TYPE.BUY_EXPLORER })

export const attackPlayer: Move = state => ({ type: COMMAND_TYPE.ATTACK_PLAYER, amount: state.pools.combat })

export const endTurn: Move = () => ({ type: COMMAND_TYPE.END_TURN })
