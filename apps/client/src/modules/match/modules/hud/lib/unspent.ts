import type { Pools } from '@space/engine'
import type { LegalIndex } from '../../table'
import { RESOURCE } from '@space/engine'

/** Ресурсы, которые ещё можно потратить к концу хода: в конце хода пулы обнуляются. */
export interface Unspent {
  trade: number
  combat: number
}

/**
 * Что пропадёт, если закончить ход сейчас. Остаток считается потерей, только если его есть на что потратить:
 * атаку - когда можно ударить по игроку или по базе, торговлю - когда можно что-то купить. Единичная торговля
 * при ценах от двух не должна пугать игрока предупреждением.
 */
export function unspentResources(pools: Pools, legal: LegalIndex): Unspent | null {
  const canAttack = legal.attackPlayerAmount > 0 || legal.attackableBases.size > 0
  const canBuy = legal.buyable.size > 0 || legal.canBuyExplorer
  const trade = canBuy ? pools[RESOURCE.TRADE] : 0
  const combat = canAttack ? pools[RESOURCE.COMBAT] : 0
  return trade > 0 || combat > 0 ? { trade, combat } : null
}
