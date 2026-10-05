import type { Card, CardKind, CardSet, Faction, ValueOf } from '@space/engine'
import { CARD_KIND, CARD_SET, CARDS } from '@space/engine'
import { cardName } from '@/modules/cards'

export const SORT_KEY = {
  COST: 'cost',
  NAME: 'name',
} as const
export type SortKey = ValueOf<typeof SORT_KEY>

export const SORT_DIRECTION = {
  ASC: 'asc',
  DESC: 'desc',
} as const
export type SortDirection = ValueOf<typeof SORT_DIRECTION>

/** Названия наборов для интерфейса. */
export const SET_LABEL: Readonly<Record<CardSet, string>> = {
  [CARD_SET.CORE]: 'Базовый набор',
}

/** Допустимые размеры страницы каталога. */
export const PAGE_SIZES = [10, 20, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 20

/** Пустой список в группе означает «без ограничения»; между группами условия складываются (И), внутри группы - ИЛИ. */
export interface CatalogFilters {
  sets: CardSet[]
  factions: Faction[]
  kinds: CardKind[]
  costs: number[]
  defenses: number[]
}

export function emptyFilters(): CatalogFilters {
  return { sets: [], factions: [], kinds: [], costs: [], defenses: [] }
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return Object.values(filters).some(group => group.length > 0)
}

/** Все карты каталога (включая стартовые и Исследователей). */
export function allCards(): Card[] {
  return Object.values(CARDS)
}

function matches<T>(group: readonly T[], value: T | undefined): boolean {
  return group.length === 0 || (value !== undefined && group.includes(value))
}

export function filterCards(cards: readonly Card[], filters: CatalogFilters): Card[] {
  return cards.filter(card =>
    matches(filters.sets, card.set)
    && matches(filters.factions, card.faction)
    && matches(filters.kinds, card.kind)
    && matches(filters.costs, card.cost)
    // Защита есть только у баз и аванпостов: корабли под фильтр по защите не подходят.
    && matches(filters.defenses, card.defense),
  )
}

const byName = (a: Card, b: Card): number => cardName(a.id).localeCompare(cardName(b.id), 'ru')

/** Сортировка по стоимости или имени; равные по главному признаку идут по второму, затем по id (порядок стабилен). */
export function sortCards(cards: readonly Card[], key: SortKey, direction: SortDirection): Card[] {
  const sign = direction === SORT_DIRECTION.ASC ? 1 : -1
  const compare = key === SORT_KEY.COST
    ? (a: Card, b: Card) => (a.cost - b.cost) * sign || byName(a, b) || a.id.localeCompare(b.id)
    : (a: Card, b: Card) => byName(a, b) * sign || a.cost - b.cost || a.id.localeCompare(b.id)
  return [...cards].sort(compare)
}

export interface Page<T> {
  items: T[]
  /** Номер страницы с единицы; не выходит за границы. */
  page: number
  pages: number
}

export function paginate<T>(items: readonly T[], page: number, size: number): Page<T> {
  const pages = Math.max(1, Math.ceil(items.length / size))
  const current = Math.min(Math.max(1, page), pages)
  return { items: items.slice((current - 1) * size, current * size), page: current, pages }
}

export interface CatalogOptions {
  sets: CardSet[]
  costs: number[]
  defenses: number[]
}

const unique = (values: readonly number[]): number[] => [...new Set(values)].sort((a, b) => a - b)

/** Значения для переключателей фильтров: только те, что реально есть в каталоге. */
export function catalogOptions(cards: readonly Card[]): CatalogOptions {
  return {
    sets: [...new Set(cards.map(card => card.set))],
    costs: unique(cards.map(card => card.cost)),
    defenses: unique(cards.flatMap(card => (card.defense === undefined ? [] : [card.defense]))),
  }
}

export const KIND_ORDER: readonly CardKind[] = [CARD_KIND.SHIP, CARD_KIND.BASE, CARD_KIND.OUTPOST]
