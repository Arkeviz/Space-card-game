import type { CardInstance } from '@space/engine'
import { getCard } from '@space/engine'
import { cardName } from '@/modules/cards'

/** Строка окна просмотра стопки: одна карта или несколько одинаковых. */
export interface PileViewerItem {
  key: string
  cardId: string
  /** Сколько таких карт; больше 1 - рисуется значок «×N». */
  count: number
}

/** Сброс и свалка: каждая карта отдельно, сверху то, что легло последним. */
export function itemsFromCards(cards: readonly CardInstance[]): PileViewerItem[] {
  return [...cards].reverse().map(card => ({ key: card.id, cardId: card.cardId, count: 1 }))
}

/** Состав колоды: одинаковые карты вместе, по возрастанию цены, затем по названию. Настоящий порядок колоды скрыт. */
export function itemsFromContents(contents: Readonly<Record<string, number>>): PileViewerItem[] {
  return Object.entries(contents)
    .map(([cardId, count]) => ({ key: cardId, cardId, count }))
    .sort((a, b) => getCard(a.cardId).cost - getCard(b.cardId).cost || cardName(a.cardId).localeCompare(cardName(b.cardId), 'ru'))
}
