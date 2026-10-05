import type { Command } from '@space/engine'
import { COMMAND_TYPE, RESOURCE } from '@space/engine'
import { describe, expect, it } from 'vitest'
import { indexLegalActions } from '../../table'
import { unspentResources } from './unspent'

const pools = (trade: number, combat: number) => ({ [RESOURCE.TRADE]: trade, [RESOURCE.COMBAT]: combat })
const legal = (...actions: Command[]) => indexLegalActions([{ type: COMMAND_TYPE.END_TURN }, ...actions])

describe('unspentResources', () => {
  it('нет остатка - нет предупреждения', () => {
    expect(unspentResources(pools(0, 0), legal())).toBeNull()
  })

  it('атака, которую можно потратить на игрока или базу, предупреждает', () => {
    expect(unspentResources(pools(0, 3), legal({ type: COMMAND_TYPE.ATTACK_PLAYER, amount: 3 }))).toEqual({ trade: 0, combat: 3 })
    expect(unspentResources(pools(0, 5), legal({ type: COMMAND_TYPE.ATTACK_BASE, cardId: 'b1' }))).toEqual({ trade: 0, combat: 5 })
  })

  it('торговля предупреждает, только если на неё что-то можно купить', () => {
    expect(unspentResources(pools(1, 0), legal())).toBeNull()
    expect(unspentResources(pools(3, 0), legal({ type: COMMAND_TYPE.BUY, cardId: 'c1' }))).toEqual({ trade: 3, combat: 0 })
    expect(unspentResources(pools(2, 0), legal({ type: COMMAND_TYPE.BUY_EXPLORER }))).toEqual({ trade: 2, combat: 0 })
  })

  it('атака, которой не по кому ударить (аванпост прикрывает), не считается потерей', () => {
    expect(unspentResources(pools(0, 2), legal())).toBeNull()
  })

  it('оба ресурса вместе', () => {
    const actions = legal({ type: COMMAND_TYPE.ATTACK_PLAYER, amount: 2 }, { type: COMMAND_TYPE.BUY_EXPLORER })
    expect(unspentResources(pools(2, 2), actions)).toEqual({ trade: 2, combat: 2 })
  })
})
