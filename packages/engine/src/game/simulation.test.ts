import type { Command, GameState, PlayerId } from '../types/index.ts'
import { describe, expect, it } from 'vitest'
import { EXPLORER_COUNT, STARTING_DECK, TRADE_DECK_COMPOSITION } from '../data/config.ts'
import { createRng } from '../lib/rng.ts'
import { RESOURCE } from '../types/index.ts'
import { apply } from './apply.ts'
import { legalActions } from './legal.ts'
import { createGame } from './setup.ts'

/** Две стартовые колоды, исследователи и вся Торговая колода: растёт вместе с каталогом. */
const TOTAL_CARDS = sum(STARTING_DECK) * 2 + EXPLORER_COUNT + sum(TRADE_DECK_COMPOSITION)

function sum(composition: Readonly<Record<string, number>> | number): number {
  return typeof composition === 'number' ? composition : Object.values(composition).reduce((total, count) => total + count, 0)
}

function cardIds(state: GameState): string[] {
  return [
    ...state.players.flatMap(p => [...p.deck, ...p.hand, ...p.discard, ...p.inPlay.map(entry => entry.card)]),
    ...state.tradeDeck,
    ...state.tradeRow.filter(card => card !== null),
    ...state.explorers,
    ...state.scrapHeap,
  ].map(card => card.id)
}

interface Playthrough {
  log: { player: PlayerId, command: Command }[]
  final: GameState
}

/** Играет случайные, но всегда допустимые команды и проверяет инварианты на каждом шаге. */
function simulate(seed: number, steps: number): Playthrough {
  const chooser = createRng(seed + 1000)
  let state = createGame(seed)
  const log: Playthrough['log'] = []

  for (let step = 0; step < steps && state.winner === null; step++) {
    const player = state.prompt ? state.prompt.player : state.currentPlayer
    const actions = legalActions(state, player)
    // Без открытого prompt всегда можно завершить ход, с prompt - ответить на него: тупиков быть не должно.
    expect(actions.length).toBeGreaterThan(0)

    const command = actions[chooser.int(actions.length)]!
    const result = apply(state, player, command)
    if (!result.ok)
      throw new Error(`Шаг ${step}: допустимая команда отклонена (${result.error})`)

    expect(result.state.version).toBe(state.version + 1)
    state = result.state
    log.push({ player, command })

    const ids = cardIds(state)
    expect(ids).toHaveLength(TOTAL_CARDS)
    expect(new Set(ids).size).toBe(TOTAL_CARDS)
    expect(state.pools[RESOURCE.TRADE]).toBeGreaterThanOrEqual(0)
    expect(state.pools[RESOURCE.COMBAT]).toBeGreaterThanOrEqual(0)
    expect(state.tradeRow).toHaveLength(5)
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
  }
  return { log, final: state }
}

describe('случайные партии', () => {
  it.each(Array.from({ length: 30 }, (_, index) => index + 1))('сид %i: карты сохраняются, тупиков нет, состояние сериализуется', (seed) => {
    const { final } = simulate(seed, 400)
    expect(final.turn).toBeGreaterThan(1)
  })

  it('одинаковые сид и выбор дают одинаковую партию', () => {
    expect(simulate(11, 200).final).toEqual(simulate(11, 200).final)
  })

  it('повтор журнала команд с того же сида даёт то же состояние', () => {
    const { log, final } = simulate(21, 300)
    let state = createGame(21)
    for (const { player, command } of log) {
      const result = apply(state, player, command)
      if (!result.ok)
        throw new Error(`Повтор журнала сломался: ${result.error}`)
      state = result.state
    }
    expect(state).toEqual(final)
  })
})
