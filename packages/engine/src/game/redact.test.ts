import { describe, expect, it } from 'vitest'
import { newGame, run } from '../testing/testkit.ts'
import { COMMAND_TYPE, EVENT_TYPE } from '../types/index.ts'
import { redact, redactEvents } from './redact.ts'

describe('redact', () => {
  it('показывает свою руку, а у соперника - только количество карт', () => {
    const state = newGame()
    const view = redact(state, 0)
    expect(view.you).toBe(0)
    expect(view.self.hand).toEqual(state.players[0].hand)
    expect(view.opponent.handCount).toBe(5)
    expect('hand' in view.opponent).toBe(false)
    expect(view.self.deckCount).toBe(7)
    expect(view.opponent.deckCount).toBe(5)
    expect(view.tradeDeckCount).toBe(state.tradeDeck.length)
    expect(view.explorersCount).toBe(state.explorers.length)
  })

  it('не содержит ни одной скрытой карты и служебного состояния', () => {
    const state = newGame()
    const json = JSON.stringify(redact(state, 0))
    const hidden = [
      ...state.players[1].hand,
      ...state.players[1].deck,
      ...state.players[0].deck,
      ...state.tradeDeck,
    ]
    for (const card of hidden)
      expect(json).not.toContain(`"id":"${card.id}"`)
    for (const key of ['rngState', 'continuation', 'promptCounter', '"deck"', '"tradeDeck"'])
      expect(json).not.toContain(key)
  })

  it('состав своей колоды виден без порядка, у соперника его нет', () => {
    const state = newGame()
    const view = redact(state, 0)
    const expected: Record<string, number> = {}
    for (const card of state.players[0].deck)
      expected[card.cardId] = (expected[card.cardId] ?? 0) + 1
    expect(view.self.deckContents).toEqual(expected)
    expect(Object.values(view.self.deckContents).reduce((sum, n) => sum + n, 0)).toBe(view.self.deckCount)
    expect(Object.keys(view.self.deckContents)).toEqual(['scout', 'viper'])
    expect('deckContents' in view.opponent).toBe(false)
  })

  it('состав колоды не зависит от её порядка', () => {
    const state = newGame()
    const reversed = { ...state, players: [{ ...state.players[0], deck: [...state.players[0].deck].reverse() }, state.players[1]] } as typeof state
    expect(JSON.stringify(redact(reversed, 0).self.deckContents)).toBe(JSON.stringify(redact(state, 0).self.deckContents))
  })

  it('симметричен: второй игрок видит свою руку и не видит чужую', () => {
    const state = newGame()
    const view = redact(state, 1)
    expect(view.self.hand).toEqual(state.players[1].hand)
    expect(view.opponent.handCount).toBe(3)
  })

  it('сброс и стол видны обоим', () => {
    const state = newGame()
    state.players[1].discard = [{ id: 'x', cardId: 'scout' }]
    expect(redact(state, 0).opponent.discard).toEqual([{ id: 'x', cardId: 'scout' }])
  })
})

describe('redactEvents', () => {
  it('прячет карты, взятые соперником, но оставляет их количество', () => {
    const { events } = run(newGame(), 0, { type: COMMAND_TYPE.END_TURN })
    const draw = events.find(event => event.type === EVENT_TYPE.CARDS_DRAWN)
    expect(draw).toMatchObject({ player: 0, count: 5 })
    expect(draw && 'cards' in draw && draw.cards).toHaveLength(5)

    const forOpponent = redactEvents(events, 1).find(event => event.type === EVENT_TYPE.CARDS_DRAWN)
    expect(forOpponent).toEqual({ type: EVENT_TYPE.CARDS_DRAWN, player: 0, count: 5 })

    const forOwner = redactEvents(events, 0).find(event => event.type === EVENT_TYPE.CARDS_DRAWN)
    expect(forOwner).toEqual(draw)
  })

  it('не меняет остальные события', () => {
    const { events } = run(newGame(), 0, { type: COMMAND_TYPE.END_TURN })
    const others = events.filter(event => event.type !== EVENT_TYPE.CARDS_DRAWN)
    expect(redactEvents(events, 1).filter(event => event.type !== EVENT_TYPE.CARDS_DRAWN)).toEqual(others)
  })
})
