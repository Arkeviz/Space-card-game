import { describe, expect, it } from 'vitest'
import { errorOf, newGame, run, setHand, setInPlay, setRow } from '../testing/testkit.ts'
import { ABILITY_KIND, COMMAND_ERROR, COMMAND_TYPE, RESOURCE } from '../types/index.ts'
import { legalActions } from './legal.ts'

describe('legalActions', () => {
  it('в начале хода: розыгрыш карт руки и конец хода, ничего лишнего', () => {
    const state = newGame()
    const actions = legalActions(state, 0)
    expect(actions).toContainEqual({ type: COMMAND_TYPE.END_TURN })
    for (const card of state.players[0].hand)
      expect(actions).toContainEqual({ type: COMMAND_TYPE.PLAY_CARD, cardId: card.id })
    expect(actions.some(action => action.type === COMMAND_TYPE.BUY || action.type === COMMAND_TYPE.BUY_EXPLORER)).toBe(false)
    expect(actions.some(action => action.type === COMMAND_TYPE.ATTACK_PLAYER)).toBe(false)
    expect(actions).toHaveLength(state.players[0].hand.length + 1)
  })

  it('игроку не в свой ход доступных действий нет', () => {
    expect(legalActions(newGame(), 1)).toEqual([])
  })

  it('появляется покупка, когда хватает торговли', () => {
    const state = newGame()
    const [shuttle, cutter] = setRow(state, ['federation-shuttle', 'cutter', 'royal-redoubt', 'cutter', 'cutter'])
    state.pools[RESOURCE.TRADE] = 2
    const actions = legalActions(state, 0)
    expect(actions).toContainEqual({ type: COMMAND_TYPE.BUY, cardId: shuttle.id })
    expect(actions).toContainEqual({ type: COMMAND_TYPE.BUY, cardId: cutter.id })
    expect(actions).toContainEqual({ type: COMMAND_TYPE.BUY_EXPLORER })
    expect(actions.filter(action => action.type === COMMAND_TYPE.BUY)).toHaveLength(4)
  })

  it('атаки учитывают аванпосты', () => {
    const state = newGame()
    const [station, wheel] = setInPlay(state, 1, ['battle-station', 'blob-wheel'])
    state.pools[RESOURCE.COMBAT] = 5
    const actions = legalActions(state, 0)
    expect(actions).toContainEqual({ type: COMMAND_TYPE.ATTACK_BASE, cardId: station.id })
    expect(actions).not.toContainEqual({ type: COMMAND_TYPE.ATTACK_BASE, cardId: wheel.id })
    expect(actions.some(action => action.type === COMMAND_TYPE.ATTACK_PLAYER)).toBe(false)
  })

  it('активации: только доступные способности', () => {
    const state = newGame()
    const [post] = setInPlay(state, 0, ['trading-post'])
    const actions = legalActions(state, 0)
    expect(actions).toContainEqual({ type: COMMAND_TYPE.ACTIVATE, cardId: post.id, ability: ABILITY_KIND.BASIC })
    expect(actions).toContainEqual({ type: COMMAND_TYPE.ACTIVATE, cardId: post.id, ability: ABILITY_KIND.SCRAP })
    expect(actions.some(action => action.type === COMMAND_TYPE.ACTIVATE && action.ability === ABILITY_KIND.ALLY)).toBe(false)
  })

  it('при открытом prompt доступны только ответы игрока, который должен ответить', () => {
    const state = newGame()
    const [fighter] = setHand(state, 0, ['imperial-fighter'])
    const [a, b] = setHand(state, 1, ['scout', 'viper'])
    const { state: waiting } = run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: fighter.id })
    const promptId = waiting.prompt!.id

    expect(legalActions(waiting, 0)).toEqual([])
    expect(legalActions(waiting, 1)).toEqual([
      { type: COMMAND_TYPE.CHOOSE_CARD, promptId, cardId: a.id },
      { type: COMMAND_TYPE.CHOOSE_CARD, promptId, cardId: b.id },
    ])
  })

  it('у необязательной утилизации есть SKIP, у обязательной нет', () => {
    const optional = newGame()
    const [bot] = setHand(optional, 0, ['trade-bot', 'scout'])
    const { state: withOptional } = run(optional, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: bot.id })
    expect(legalActions(withOptional, 0)).toContainEqual({ type: COMMAND_TYPE.SKIP, promptId: withOptional.prompt!.id })

    const mandatory = newGame()
    const [base] = setInPlay(mandatory, 0, ['machine-base'])
    const { state: withMandatory } = run(mandatory, 0, { type: COMMAND_TYPE.ACTIVATE, cardId: base.id, ability: ABILITY_KIND.BASIC })
    expect(legalActions(withMandatory, 0).some(action => action.type === COMMAND_TYPE.SKIP)).toBe(false)
  })

  it('каждое предложенное действие действительно принимается', () => {
    const state = newGame()
    state.pools[RESOURCE.TRADE] = 3
    state.pools[RESOURCE.COMBAT] = 2
    for (const action of legalActions(state, 0))
      expect(() => run(state, 0, action)).not.toThrow()
    expect(errorOf(state, 0, { type: COMMAND_TYPE.BUY, cardId: 'нет' })).toBe(COMMAND_ERROR.CARD_NOT_FOUND)
  })

  it('после конца партии действий нет', () => {
    const state = newGame()
    state.players[1].authority = 1
    state.pools[RESOURCE.COMBAT] = 1
    const { state: over } = run(state, 0, { type: COMMAND_TYPE.ATTACK_PLAYER, amount: 1 })
    expect(legalActions(over, 0)).toEqual([])
    expect(legalActions(over, 1)).toEqual([])
  })
})
