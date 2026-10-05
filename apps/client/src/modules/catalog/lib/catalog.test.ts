import type { Card } from '@space/engine'
import { CARD_KIND, CARD_SET, CARDS, FACTION } from '@space/engine'
import { describe, expect, it } from 'vitest'
import { allCards, catalogOptions, emptyFilters, filterCards, hasActiveFilters, paginate, SORT_DIRECTION, SORT_KEY, sortCards } from './catalog'

const cards = allCards()

describe('filterCards', () => {
  it('без фильтров возвращает весь каталог', () => {
    expect(filterCards(cards, emptyFilters())).toHaveLength(cards.length)
    expect(hasActiveFilters(emptyFilters())).toBe(false)
  })

  it('внутри группы условия складываются по ИЛИ, между группами - по И', () => {
    const blobOrCult = filterCards(cards, { ...emptyFilters(), factions: [FACTION.BLOB, FACTION.MACHINE_CULT] })
    expect(blobOrCult.length).toBeGreaterThan(0)
    expect(blobOrCult.every(card => card.faction === FACTION.BLOB || card.faction === FACTION.MACHINE_CULT)).toBe(true)

    const onlyBlobBases = filterCards(cards, { ...emptyFilters(), factions: [FACTION.BLOB], kinds: [CARD_KIND.BASE] })
    expect(onlyBlobBases.every(card => card.faction === FACTION.BLOB && card.kind === CARD_KIND.BASE)).toBe(true)
  })

  it('по стоимости и по набору', () => {
    expect(filterCards(cards, { ...emptyFilters(), costs: [2, 3] }).every(card => card.cost === 2 || card.cost === 3)).toBe(true)
    expect(filterCards(cards, { ...emptyFilters(), sets: [CARD_SET.CORE] })).toHaveLength(cards.length)
    expect(filterCards(cards, { ...emptyFilters(), costs: [999] })).toEqual([])
  })

  it('по защите подходят только базы и аванпосты', () => {
    const [defense] = catalogOptions(cards).defenses
    const found = filterCards(cards, { ...emptyFilters(), defenses: [defense!] })
    expect(found.length).toBeGreaterThan(0)
    expect(found.every(card => card.kind !== CARD_KIND.SHIP && card.defense === defense)).toBe(true)
  })
})

describe('sortCards', () => {
  const sample = ['scout', 'viper', 'explorer', 'fleet-hq'].map(id => CARDS[id]!) as Card[]

  it('по стоимости: при равной цене по имени, в обе стороны', () => {
    const asc = sortCards(sample, SORT_KEY.COST, SORT_DIRECTION.ASC).map(card => card.cost)
    expect(asc).toEqual([...asc].sort((a, b) => a - b))
    const desc = sortCards(sample, SORT_KEY.COST, SORT_DIRECTION.DESC).map(card => card.cost)
    expect(desc).toEqual([...desc].sort((a, b) => b - a))
  })

  it('по имени: по русскому алфавиту, обратный порядок - зеркальный', () => {
    const asc = sortCards(cards, SORT_KEY.NAME, SORT_DIRECTION.ASC)
    const desc = sortCards(cards, SORT_KEY.NAME, SORT_DIRECTION.DESC)
    expect(desc.map(card => card.id)).toEqual([...asc].reverse().map(card => card.id))
  })

  it('не меняет исходный массив', () => {
    const copy = [...sample]
    sortCards(sample, SORT_KEY.NAME, SORT_DIRECTION.ASC)
    expect(sample).toEqual(copy)
  })
})

describe('paginate', () => {
  const items = Array.from({ length: 10 }, (_, index) => index)

  it('режет на страницы и не выходит за границы', () => {
    expect(paginate(items, 1, 4)).toEqual({ items: [0, 1, 2, 3], page: 1, pages: 3 })
    expect(paginate(items, 3, 4)).toEqual({ items: [8, 9], page: 3, pages: 3 })
    expect(paginate(items, 99, 4).page).toBe(3)
    expect(paginate(items, 0, 4).page).toBe(1)
  })

  it('пустой список - одна пустая страница', () => {
    expect(paginate([], 1, 12)).toEqual({ items: [], page: 1, pages: 1 })
  })
})

describe('catalogOptions', () => {
  it('значения для фильтров берутся из каталога, по возрастанию', () => {
    const options = catalogOptions(cards)
    expect(options.sets).toEqual([CARD_SET.CORE])
    expect(options.costs).toEqual([...options.costs].sort((a, b) => a - b))
    expect(options.defenses.length).toBeGreaterThan(0)
  })
})
