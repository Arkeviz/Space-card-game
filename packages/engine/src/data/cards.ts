import type { Card, Effect, Resource, ScrapZone } from '../types/index.ts'
import { ABILITY_KIND, CARD_KIND, EFFECT_TYPE, FACTION, RESOURCE, SCRAP_ZONE } from '../types/index.ts'

const gain = (resource: Resource, amount: number): Effect => ({ type: EFFECT_TYPE.GAIN, resource, amount })
const trade = (amount: number) => gain(RESOURCE.TRADE, amount)
const combat = (amount: number) => gain(RESOURCE.COMBAT, amount)
const authority = (amount: number) => gain(RESOURCE.AUTHORITY, amount)
const draw = (amount: number): Effect => ({ type: EFFECT_TYPE.DRAW, amount })
const opponentDiscard = (amount: number): Effect => ({ type: EFFECT_TYPE.OPPONENT_DISCARD, amount })
const choice = (...options: Effect[][]): Effect => ({ type: EFFECT_TYPE.CHOICE, options })
const scrap = (from: ScrapZone[], optional: boolean): Effect => ({ type: EFFECT_TYPE.SCRAP, from, optional })

/*
 * Каталог карт. Значения переносились по памяти из базового набора и НЕ сверены с физической игрой.
 * TODO исправить описания карт
 */
const cards: Card[] = [
  // Стартовые карты и Исследователи
  { id: 'scout', name: 'Scout', faction: FACTION.NEUTRAL, kind: CARD_KIND.SHIP, cost: 0, abilities: { [ABILITY_KIND.BASIC]: [trade(1)] } },
  { id: 'viper', name: 'Viper', faction: FACTION.NEUTRAL, kind: CARD_KIND.SHIP, cost: 0, abilities: { [ABILITY_KIND.BASIC]: [combat(1)] } },
  {
    id: 'explorer',
    name: 'Explorer',
    faction: FACTION.NEUTRAL,
    kind: CARD_KIND.SHIP,
    cost: 2,
    abilities: { [ABILITY_KIND.BASIC]: [trade(2)], [ABILITY_KIND.SCRAP]: [combat(2)] },
  },

  // Торговая федерация
  {
    id: 'federation-shuttle',
    name: 'Federation Shuttle',
    faction: FACTION.TRADE_FEDERATION,
    kind: CARD_KIND.SHIP,
    cost: 1,
    abilities: { [ABILITY_KIND.BASIC]: [trade(2)] },
  },
  {
    id: 'cutter',
    name: 'Cutter',
    faction: FACTION.TRADE_FEDERATION,
    kind: CARD_KIND.SHIP,
    cost: 2,
    abilities: { [ABILITY_KIND.BASIC]: [authority(1), trade(2)], [ABILITY_KIND.ALLY]: [combat(4)] },
  },
  {
    id: 'trading-post',
    name: 'Trading Post',
    faction: FACTION.TRADE_FEDERATION,
    kind: CARD_KIND.OUTPOST,
    cost: 3,
    defense: 4,
    abilities: { [ABILITY_KIND.BASIC]: [choice([authority(1)], [trade(1)])], [ABILITY_KIND.SCRAP]: [combat(3)] },
  },
  {
    id: 'barter-world',
    name: 'Barter World',
    faction: FACTION.TRADE_FEDERATION,
    kind: CARD_KIND.BASE,
    cost: 4,
    defense: 4,
    abilities: { [ABILITY_KIND.BASIC]: [choice([authority(2)], [trade(2)])], [ABILITY_KIND.SCRAP]: [combat(5)] },
  },

  // Блоб
  {
    id: 'blob-fighter',
    name: 'Blob Fighter',
    faction: FACTION.BLOB,
    kind: CARD_KIND.SHIP,
    cost: 1,
    abilities: { [ABILITY_KIND.BASIC]: [combat(3)], [ABILITY_KIND.ALLY]: [draw(1)] },
  },
  {
    id: 'battle-pod',
    name: 'Battle Pod',
    faction: FACTION.BLOB,
    kind: CARD_KIND.SHIP,
    cost: 2,
    abilities: { [ABILITY_KIND.BASIC]: [combat(4), scrap([SCRAP_ZONE.TRADE_ROW], true)], [ABILITY_KIND.ALLY]: [combat(2)] },
  },
  {
    id: 'blob-wheel',
    name: 'Blob Wheel',
    faction: FACTION.BLOB,
    kind: CARD_KIND.BASE,
    cost: 3,
    defense: 5,
    abilities: { [ABILITY_KIND.BASIC]: [combat(1)], [ABILITY_KIND.SCRAP]: [trade(3)] },
  },

  // Машинный культ
  {
    id: 'trade-bot',
    name: 'Trade Bot',
    faction: FACTION.MACHINE_CULT,
    kind: CARD_KIND.SHIP,
    cost: 1,
    abilities: {
      [ABILITY_KIND.BASIC]: [trade(1), scrap([SCRAP_ZONE.HAND, SCRAP_ZONE.DISCARD], true)],
      [ABILITY_KIND.ALLY]: [combat(2)],
    },
  },
  {
    id: 'battle-station',
    name: 'Battle Station',
    faction: FACTION.MACHINE_CULT,
    kind: CARD_KIND.OUTPOST,
    cost: 3,
    defense: 5,
    abilities: { [ABILITY_KIND.SCRAP]: [combat(5)] },
  },
  {
    id: 'machine-base',
    name: 'Machine Base',
    faction: FACTION.MACHINE_CULT,
    kind: CARD_KIND.OUTPOST,
    cost: 7,
    defense: 6,
    abilities: { [ABILITY_KIND.BASIC]: [draw(1), scrap([SCRAP_ZONE.HAND], false)] },
  },

  // Звёздная империя
  {
    id: 'imperial-fighter',
    name: 'Imperial Fighter',
    faction: FACTION.STAR_EMPIRE,
    kind: CARD_KIND.SHIP,
    cost: 1,
    abilities: { [ABILITY_KIND.BASIC]: [combat(2), opponentDiscard(1)], [ABILITY_KIND.ALLY]: [combat(2)] },
  },
  {
    id: 'corvette',
    name: 'Corvette',
    faction: FACTION.STAR_EMPIRE,
    kind: CARD_KIND.SHIP,
    cost: 2,
    abilities: { [ABILITY_KIND.BASIC]: [combat(1), draw(1)], [ABILITY_KIND.ALLY]: [combat(2)] },
  },
  {
    id: 'royal-redoubt',
    name: 'Royal Redoubt',
    faction: FACTION.STAR_EMPIRE,
    kind: CARD_KIND.OUTPOST,
    cost: 6,
    defense: 6,
    abilities: { [ABILITY_KIND.BASIC]: [combat(3)], [ABILITY_KIND.ALLY]: [opponentDiscard(1)] },
  },
]

export const CARDS: Readonly<Record<string, Card>> = Object.fromEntries(cards.map(card => [card.id, card]))

export function getCard(cardId: string): Card {
  const card = CARDS[cardId]
  if (!card)
    throw new Error(`Unknown card definition: ${cardId}`)
  return card
}
