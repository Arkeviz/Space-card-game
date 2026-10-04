import type { GameEvent } from '@space/engine'
import { ABILITY_KIND, createGame, EVENT_TYPE, redact, RESOURCE } from '@space/engine'
import { describe, expect, it } from 'vitest'
import { buildTable } from '../../table'
import { describeStep, LOG_KIND } from './describe'
import { FX_TARGET, FX_TONE } from './fx'

const table = buildTable(redact(createGame(5, { firstPlayer: 0 }), 0))

describe('describeStep', () => {
  it('смена хода - заголовок журнала с указанием, чей ход', () => {
    const out = describeStep([{ type: EVENT_TYPE.TURN_STARTED, player: 1, turn: 4 }], table, table)
    expect(out.entries).toEqual([{ kind: LOG_KIND.HEAD, mine: false, text: 'ХОД 4 · СОПЕРНИК' }])
  })

  it('розыгрыш корабля описывает его эффект, розыгрыш базы - прочность', () => {
    const ship = describeStep([{ type: EVENT_TYPE.CARD_PLAYED, player: 0, card: { id: 'a', cardId: 'cutter' } }], table, table)
    expect(ship.entries[0]!.text).toBe('Разыграна «Катер»: +1 авторитета, +2 торговли')
    const base = describeStep([{ type: EVENT_TYPE.CARD_PLAYED, player: 1, card: { id: 'b', cardId: 'barter-world' } }], table, table)
    expect(base.entries[0]).toMatchObject({ mine: false, text: 'Разыграна «Мир бартера» - база, прочность 4' })
  })

  it('атака по игроку: запись и красное число у авторитета пострадавшего', () => {
    const events: GameEvent[] = [{ type: EVENT_TYPE.PLAYER_ATTACKED, attacker: 1, target: 0, amount: 3 }]
    const out = describeStep(events, table, table)
    expect(out.entries[0]).toMatchObject({ mine: false, text: 'Атака по вам: -3 авторитета' })
    expect(out.fx).toEqual([{ target: FX_TARGET.SELF_AUTHORITY, text: '-3', tone: FX_TONE.LOSS }])
  })

  it('ресурсы дают только всплывающие числа, а не записи журнала', () => {
    const events: GameEvent[] = [
      { type: EVENT_TYPE.RESOURCE_GAINED, player: 0, resource: RESOURCE.TRADE, amount: 2 },
      { type: EVENT_TYPE.RESOURCE_GAINED, player: 0, resource: RESOURCE.AUTHORITY, amount: 1 },
    ]
    const out = describeStep(events, table, table)
    expect(out.entries).toEqual([])
    expect(out.fx).toEqual([
      { target: FX_TARGET.TRADE, text: '+2', tone: FX_TONE.GAIN },
      { target: FX_TARGET.SELF_AUTHORITY, text: '+1', tone: FX_TONE.GAIN },
    ])
  })

  it('сброс руки в конце хода журнал не засоряет', () => {
    const events: GameEvent[] = [{ type: EVENT_TYPE.CARD_DISCARDED, player: 0, card: { id: 'a', cardId: 'scout' }, from: 'hand' }]
    expect(describeStep(events, table, table).entries).toEqual([])
  })

  it('утилизация способностью: запись берёт карту из свалки, где она уже лежит', () => {
    const card = { id: 'z', cardId: 'explorer' }
    const after = { ...table, scrapHeap: [card] }
    const out = describeStep([{ type: EVENT_TYPE.ABILITY_ACTIVATED, player: 0, cardId: 'z', ability: ABILITY_KIND.SCRAP }], table, after)
    expect(out.entries[0]!.text).toBe('«Исследователь» утилизирована: +2 атаки')
  })
})
