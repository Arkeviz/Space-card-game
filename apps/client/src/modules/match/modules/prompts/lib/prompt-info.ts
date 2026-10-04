import type { CardInstance, Effect, PlayedCard } from '@space/engine'
import type { TableState } from '../../table'
import { EFFECT_TYPE, getCard, RESOURCE } from '@space/engine'

/** Карта, из-за которой открыт prompt (по id экземпляра), где бы она сейчас ни лежала. */
export function findSourceCard(table: TableState, source: string | null): CardInstance | null {
  if (!source)
    return null
  const inPlay = (entries: PlayedCard[]): CardInstance | undefined => entries.find(entry => entry.card.id === source)?.card
  const scrapped = table.scrapHeap.find(card => card.id === source)
  return inPlay(table.self.inPlay)
    ?? inPlay(table.opponent.inPlay)
    ?? table.self.hand.find(card => card.id === source)
    ?? scrapped
    ?? null
}

/** Что изменится, если выбрать вариант: «Авторитет 37 → 39», «Торговля 2 → 4 · на рынке станут доступны ещё 3 карты». */
export function previewOption(table: TableState, option: readonly Effect[]): string {
  const parts: string[] = []
  for (const effect of option) {
    if (effect.type !== EFFECT_TYPE.GAIN)
      continue
    if (effect.resource === RESOURCE.AUTHORITY) {
      parts.push(`Авторитет ${table.self.authority} → ${table.self.authority + effect.amount}`)
    }
    else if (effect.resource === RESOURCE.TRADE) {
      const before = table.pools.trade
      const after = before + effect.amount
      const unlocked = table.tradeRow.filter((card) => {
        if (!card)
          return false
        const cost = getCard(card.cardId).cost
        return cost > before && cost <= after
      }).length
      const extra = unlocked > 0 ? ` · на рынке станут доступны ещё ${unlocked} ${unlocked === 1 ? 'карта' : unlocked < 5 ? 'карты' : 'карт'}` : ''
      parts.push(`Торговля ${before} → ${after}${extra}`)
    }
    else {
      parts.push(`Атака ${table.pools.combat} → ${table.pools.combat + effect.amount}`)
    }
  }
  return parts.join(' · ')
}
