import type { GameEvent } from '@space/engine'
import { createGame, EVENT_TYPE, redact } from '@space/engine'
import { describe, expect, it } from 'vitest'
import { buildTable } from '../../table'
import { layoutOf, opponentDeckPose, selfDeckPose, tradeDeckPose } from './layout'
import { motionFor } from './motion'
import { NODE_KEY } from './nodes'

const table = buildTable(redact(createGame(5, { firstPlayer: 0 }), 0))
const card = (id: string) => ({ id, cardId: 'scout' })

describe('motionFor', () => {
  it('свои взятые карты вылетают из колоды рубашкой вверх по одной', () => {
    const events: GameEvent[] = [
      { type: EVENT_TYPE.CARDS_DRAWN, player: 0, count: 2, cards: [card('a'), card('b')] },
    ]
    const motion = motionFor(events, table)
    expect(motion.spawn.get('a')).toEqual({ from: selfDeckPose(), faceDown: true })
    expect(motion.delay.get('b')!).toBeGreaterThan(motion.delay.get('a')!)
  })

  it('карты соперника - новые рубашки в конце веера, вылетают из его колоды', () => {
    const events: GameEvent[] = [{ type: EVENT_TYPE.CARDS_DRAWN, player: 1, count: 2 }]
    const motion = motionFor(events, table)
    const first = NODE_KEY.opponentHand(table.opponent.handCount)
    expect(motion.spawn.get(first)).toEqual({ from: opponentDeckPose(), faceDown: true })
    expect(motion.spawn.has(NODE_KEY.opponentHand(table.opponent.handCount + 1))).toBe(true)
  })

  it('розыгрыш карты соперником: карта появляется из его руки рубашкой вверх и переворачивается', () => {
    const motion = motionFor([{ type: EVENT_TYPE.CARD_PLAYED, player: 1, card: card('x') }], table)
    expect(motion.spawn.get('x')?.faceDown).toBe(true)
  })

  it('свой розыгрыш не создаёт подсказок: карта уже на столе и просто переезжает', () => {
    const motion = motionFor([{ type: EVENT_TYPE.CARD_PLAYED, player: 0, card: card('x') }], table)
    expect(motion.spawn.size).toBe(0)
  })

  it('новая карта торгового ряда вылетает из колоды рынка', () => {
    const motion = motionFor([{ type: EVENT_TYPE.TRADE_ROW_REFILLED, slot: 2, card: card('r') }], table)
    expect(motion.spawn.get('r')?.from).toEqual(tradeDeckPose(layoutOf(table).trade))
  })

  it('перемешивание: верхние карты сброса улетают в колоду', () => {
    const withDiscard = { ...table, self: { ...table.self, discard: [card('d1'), card('d2'), card('d3')] } }
    const motion = motionFor([{ type: EVENT_TYPE.DECK_SHUFFLED, player: 0, count: 3 }], withDiscard)
    expect([...motion.exit.keys()]).toEqual(['d2', 'd3'])
    expect(motion.exit.get('d3')).toMatchObject({ x: selfDeckPose().x, y: selfDeckPose().y, opacity: 0 })
  })
})
