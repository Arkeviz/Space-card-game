import type { Command, GameState, PlayerId } from '@space/engine'
import { apply, createGame, createRng, legalActions, redact, redactEvents } from '@space/engine'
import { describe, expect, it } from 'vitest'
import { buildTable } from './build'
import { indexLegalActions } from './legal-index'
import { reduceEvent } from './reduce'

/**
 * Главный инвариант клиента: стол, к которому по очереди применены события update'а, совпадает со столом,
 * построенным из снимка того же update'а. Иначе после анимации экран «перескакивал» бы к серверному состоянию.
 */
function playAndCompare(seed: number, steps: number): void {
  const chooser = createRng(seed + 1000)
  let state: GameState = createGame(seed)
  let tables = [buildTable(redact(state, 0)), buildTable(redact(state, 1))]

  for (let step = 0; step < steps && state.winner === null; step++) {
    const player: PlayerId = state.prompt ? state.prompt.player : state.currentPlayer
    const actions = legalActions(state, player)
    const command: Command = actions[chooser.int(actions.length)]!
    const result = apply(state, player, command)
    if (!result.ok)
      throw new Error(`Шаг ${step}: допустимая команда отклонена (${result.error})`)

    state = result.state
    tables = ([0, 1] as const).map((viewer) => {
      const events = redactEvents(result.events, viewer)
      return events.reduce(reduceEvent, tables[viewer]!)
    })

    for (const viewer of [0, 1] as const) {
      expect(tables[viewer], `seed ${seed}, шаг ${step}, зритель ${viewer}, команда ${JSON.stringify(command)}`)
        .toEqual(buildTable(redact(state, viewer)))
    }
  }
}

describe('reduceEvent', () => {
  it.each(Array.from({ length: 30 }, (_, index) => index + 1))('события воспроизводят снимок сервера (seed %i)', (seed) => {
    playAndCompare(seed, 400)
  })

  it('не изменяет исходный стол', () => {
    const state = createGame(5, { firstPlayer: 0 })
    const table = buildTable(redact(state, 0))
    const before = JSON.stringify(table)
    const result = apply(state, 0, { type: 'END_TURN' })
    if (!result.ok)
      throw new Error('END_TURN отклонён')
    result.events.map(event => reduceEvent(table, event))
    expect(JSON.stringify(table)).toBe(before)
  })
})

describe('indexLegalActions', () => {
  it('раскладывает команды по видам', () => {
    const index = indexLegalActions([
      { type: 'PLAY_CARD', cardId: 'a' },
      { type: 'BUY', cardId: 'b' },
      { type: 'BUY_EXPLORER' },
      { type: 'ACTIVATE', cardId: 'c', ability: 'basic' },
      { type: 'ACTIVATE', cardId: 'c', ability: 'scrap' },
      { type: 'ATTACK_BASE', cardId: 'd' },
      { type: 'ATTACK_PLAYER', amount: 4 },
      { type: 'END_TURN' },
    ])
    expect(index.playable).toEqual(new Set(['a']))
    expect(index.buyable).toEqual(new Set(['b']))
    expect(index.canBuyExplorer).toBe(true)
    expect(index.activations.get('c')).toEqual(new Set(['basic', 'scrap']))
    expect(index.attackableBases).toEqual(new Set(['d']))
    expect(index.attackPlayerAmount).toBe(4)
    expect(index.canEndTurn).toBe(true)
    expect(index.promptId).toBeNull()
  })

  it('ответы на prompt: варианты, карты, пропуск и номер prompt', () => {
    const index = indexLegalActions([
      { type: 'CHOOSE_CARD', promptId: 3, cardId: 'x' },
      { type: 'CHOOSE_OPTION', promptId: 3, index: 1 },
      { type: 'SKIP', promptId: 3 },
    ])
    expect(index.promptCards).toEqual(new Set(['x']))
    expect(index.promptOptions).toEqual(new Set([1]))
    expect(index.canSkip).toBe(true)
    expect(index.promptId).toBe(3)
  })
})
