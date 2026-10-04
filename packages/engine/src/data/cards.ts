import type { Card, Effect, Faction, Resource, ScrapZone } from '../types/index.ts'
import { ABILITY_KIND, CARD_KIND, EFFECT_TYPE, FACTION, PASSIVE_TYPE, RESOURCE, SCRAP_ZONE } from '../types/index.ts'

const gain = (resource: Resource, amount: number): Effect => ({ type: EFFECT_TYPE.GAIN, resource, amount })
const trade = (amount: number) => gain(RESOURCE.TRADE, amount)
const combat = (amount: number) => gain(RESOURCE.COMBAT, amount)
const authority = (amount: number) => gain(RESOURCE.AUTHORITY, amount)
const draw = (amount: number): Effect => ({ type: EFFECT_TYPE.DRAW, amount })
const opponentDiscard = (amount: number): Effect => ({ type: EFFECT_TYPE.OPPONENT_DISCARD, amount })
const choice = (...options: Effect[][]): Effect => ({ type: EFFECT_TYPE.CHOICE, options })
const scrap = (from: ScrapZone[], optional: boolean): Effect => ({ type: EFFECT_TYPE.SCRAP, from, optional })
/** «Можете утилизировать карту из руки или сброса» - у большинства карт Технокульта. */
const scrapOwn = (): Effect => scrap([SCRAP_ZONE.HAND, SCRAP_ZONE.DISCARD], true)
const destroyBase = (optional: boolean): Effect => ({ type: EFFECT_TYPE.DESTROY_BASE, optional })
const acquireShip = (): Effect => ({ type: EFFECT_TYPE.ACQUIRE_SHIP })
const nextShipToDeckTop = (): Effect => ({ type: EFFECT_TYPE.SHIP_TO_DECK_TOP })
const drawIfBases = (minBases: number, amount: number): Effect => ({ type: EFFECT_TYPE.DRAW_IF_BASES, minBases, amount })
const drawPerPlayed = (faction: Faction): Effect => ({ type: EFFECT_TYPE.DRAW_PER_PLAYED, faction })
const discardDraw = (max: number): Effect => ({ type: EFFECT_TYPE.DISCARD_DRAW, max })
const copyShip = (): Effect => ({ type: EFFECT_TYPE.COPY_SHIP })

/*
 * Каталог карт базового набора. Значения записаны по памяти и НЕ сверены с физической игрой:
 * TODO сверить числа и тексты каждой карты с настоящими картами.
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
    abilities: {
      [ABILITY_KIND.BASIC]: [trade(2)],
      [ABILITY_KIND.SCRAP]: [combat(2)],
    },
  },

  // Торговая федерация
  {
    id: 'federation-shuttle',
    name: 'Federation Shuttle',
    faction: FACTION.TRADE_FEDERATION,
    kind: CARD_KIND.SHIP,
    cost: 1,
    abilities: {
      [ABILITY_KIND.BASIC]: [trade(2)],
      [ABILITY_KIND.ALLY]: [authority(4)],
    },
  },
  {
    id: 'cutter',
    name: 'Cutter',
    faction: FACTION.TRADE_FEDERATION,
    kind: CARD_KIND.SHIP,
    cost: 2,
    abilities: {
      [ABILITY_KIND.BASIC]: [authority(4), trade(2)],
      [ABILITY_KIND.ALLY]: [combat(4)],
    },
  },
  {
    id: 'embassy-yacht',
    name: 'Embassy Yacht',
    faction: FACTION.TRADE_FEDERATION,
    kind: CARD_KIND.SHIP,
    cost: 3,
    abilities: { [ABILITY_KIND.BASIC]: [authority(3), trade(2), drawIfBases(2, 2)] },
  },
  {
    id: 'freighter',
    name: 'Freighter',
    faction: FACTION.TRADE_FEDERATION,
    kind: CARD_KIND.SHIP,
    cost: 4,
    abilities: {
      [ABILITY_KIND.BASIC]: [trade(4)],
      [ABILITY_KIND.ALLY]: [nextShipToDeckTop()],
    },
  },
  {
    id: 'trade-escort',
    name: 'Trade Escort',
    faction: FACTION.TRADE_FEDERATION,
    kind: CARD_KIND.SHIP,
    cost: 5,
    abilities: {
      [ABILITY_KIND.BASIC]: [authority(4), combat(4)],
      [ABILITY_KIND.ALLY]: [draw(1)],
    },
  },
  {
    id: 'flagship',
    name: 'Flagship',
    faction: FACTION.TRADE_FEDERATION,
    kind: CARD_KIND.SHIP,
    cost: 6,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(5), draw(1)],
      [ABILITY_KIND.ALLY]: [authority(5)],
    },
  },
  {
    id: 'command-ship',
    name: 'Command Ship',
    faction: FACTION.TRADE_FEDERATION,
    kind: CARD_KIND.SHIP,
    cost: 8,
    abilities: { [ABILITY_KIND.BASIC]: [authority(4), combat(5), draw(2)] },
  },
  {
    id: 'trading-post',
    name: 'Trading Post',
    faction: FACTION.TRADE_FEDERATION,
    kind: CARD_KIND.OUTPOST,
    cost: 3,
    defense: 4,
    abilities: {
      [ABILITY_KIND.BASIC]: [choice([authority(1)], [trade(1)])],
      [ABILITY_KIND.SCRAP]: [combat(3)],
    },
  },
  {
    id: 'barter-world',
    name: 'Barter World',
    faction: FACTION.TRADE_FEDERATION,
    kind: CARD_KIND.BASE,
    cost: 4,
    defense: 4,
    abilities: {
      [ABILITY_KIND.BASIC]: [choice([authority(2)], [trade(2)])],
      [ABILITY_KIND.SCRAP]: [combat(5)],
    },
  },
  {
    id: 'defense-center',
    name: 'Defense Center',
    faction: FACTION.TRADE_FEDERATION,
    kind: CARD_KIND.OUTPOST,
    cost: 5,
    defense: 5,
    abilities: {
      [ABILITY_KIND.BASIC]: [choice([authority(3)], [combat(2)])],
      [ABILITY_KIND.ALLY]: [combat(2)],
    },
  },
  {
    id: 'port-of-call',
    name: 'Port of Call',
    faction: FACTION.TRADE_FEDERATION,
    kind: CARD_KIND.OUTPOST,
    cost: 6,
    defense: 6,
    abilities: {
      [ABILITY_KIND.BASIC]: [trade(3)],
      [ABILITY_KIND.SCRAP]: [draw(1), destroyBase(true)],
    },
  },
  {
    id: 'central-office',
    name: 'Central Office',
    faction: FACTION.TRADE_FEDERATION,
    kind: CARD_KIND.BASE,
    cost: 7,
    defense: 6,
    abilities: {
      [ABILITY_KIND.BASIC]: [trade(2), nextShipToDeckTop()],
      [ABILITY_KIND.ALLY]: [draw(1)],
    },
  },

  // Слизни
  {
    id: 'blob-fighter',
    name: 'Blob Fighter',
    faction: FACTION.BLOB,
    kind: CARD_KIND.SHIP,
    cost: 1,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(3)],
      [ABILITY_KIND.ALLY]: [draw(1)],
    },
  },
  {
    id: 'battle-pod',
    name: 'Battle Pod',
    faction: FACTION.BLOB,
    kind: CARD_KIND.SHIP,
    cost: 2,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(4), scrap([SCRAP_ZONE.TRADE_ROW], true)],
      [ABILITY_KIND.ALLY]: [combat(2)],
    },
  },
  {
    id: 'trade-pod',
    name: 'Trade Pod',
    faction: FACTION.BLOB,
    kind: CARD_KIND.SHIP,
    cost: 2,
    abilities: {
      [ABILITY_KIND.BASIC]: [trade(3)],
      [ABILITY_KIND.ALLY]: [combat(2)],
    },
  },
  {
    id: 'blob-wheel',
    name: 'Blob Wheel',
    faction: FACTION.BLOB,
    kind: CARD_KIND.BASE,
    cost: 3,
    defense: 5,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(1)],
      [ABILITY_KIND.SCRAP]: [trade(3)],
    },
  },
  {
    id: 'ram',
    name: 'Ram',
    faction: FACTION.BLOB,
    kind: CARD_KIND.SHIP,
    cost: 3,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(5)],
      [ABILITY_KIND.ALLY]: [combat(2)],
      [ABILITY_KIND.SCRAP]: [trade(3)],
    },
  },
  {
    id: 'blob-destroyer',
    name: 'Blob Destroyer',
    faction: FACTION.BLOB,
    kind: CARD_KIND.SHIP,
    cost: 4,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(6)],
      // «Можете уничтожить базу и/или утилизировать карту из торгового ряда»: два необязательных запроса подряд.
      [ABILITY_KIND.ALLY]: [destroyBase(true), scrap([SCRAP_ZONE.TRADE_ROW], true)],
    },
  },
  {
    id: 'the-hive',
    name: 'The Hive',
    faction: FACTION.BLOB,
    kind: CARD_KIND.BASE,
    cost: 5,
    defense: 5,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(3)],
      [ABILITY_KIND.ALLY]: [draw(1)],
    },
  },
  {
    id: 'battle-blob',
    name: 'Battle Blob',
    faction: FACTION.BLOB,
    kind: CARD_KIND.SHIP,
    cost: 6,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(8)],
      [ABILITY_KIND.ALLY]: [draw(1)],
      [ABILITY_KIND.SCRAP]: [combat(4)],
    },
  },
  {
    id: 'blob-carrier',
    name: 'Blob Carrier',
    faction: FACTION.BLOB,
    kind: CARD_KIND.SHIP,
    cost: 6,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(7)],
      [ABILITY_KIND.ALLY]: [acquireShip()],
    },
  },
  {
    id: 'mothership',
    name: 'Mothership',
    faction: FACTION.BLOB,
    kind: CARD_KIND.SHIP,
    cost: 7,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(6), draw(1)],
      [ABILITY_KIND.ALLY]: [draw(1)],
    },
  },
  {
    id: 'blob-world',
    name: 'Blob World',
    faction: FACTION.BLOB,
    kind: CARD_KIND.BASE,
    cost: 8,
    defense: 7,
    // «5 атаки или возьмите по карте за каждую карту слизней, сыгранную в этот ход».
    abilities: { [ABILITY_KIND.BASIC]: [choice([combat(5)], [drawPerPlayed(FACTION.BLOB)])] },
  },

  // Технокульт
  {
    id: 'trade-bot',
    name: 'Trade Bot',
    faction: FACTION.MACHINE_CULT,
    kind: CARD_KIND.SHIP,
    cost: 1,
    abilities: {
      [ABILITY_KIND.BASIC]: [trade(1), scrapOwn()],
      [ABILITY_KIND.ALLY]: [combat(2)],
    },
  },
  {
    id: 'missile-bot',
    name: 'Missile Bot',
    faction: FACTION.MACHINE_CULT,
    kind: CARD_KIND.SHIP,
    cost: 2,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(2), scrapOwn()],
      [ABILITY_KIND.ALLY]: [combat(2)],
    },
  },
  {
    id: 'supply-bot',
    name: 'Supply Bot',
    faction: FACTION.MACHINE_CULT,
    kind: CARD_KIND.SHIP,
    cost: 3,
    abilities: {
      [ABILITY_KIND.BASIC]: [trade(2), scrapOwn()],
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
    id: 'patrol-mech',
    name: 'Patrol Mech',
    faction: FACTION.MACHINE_CULT,
    kind: CARD_KIND.SHIP,
    cost: 4,
    abilities: {
      [ABILITY_KIND.BASIC]: [choice([trade(3)], [combat(5)])],
      [ABILITY_KIND.ALLY]: [scrapOwn()],
    },
  },
  {
    id: 'stealth-needle',
    name: 'Stealth Needle',
    faction: FACTION.MACHINE_CULT,
    kind: CARD_KIND.SHIP,
    cost: 4,
    // Копирует другой корабль, сыгранный в этот ход, и получает его фракцию в дополнение к своей.
    abilities: { [ABILITY_KIND.BASIC]: [copyShip()] },
  },
  {
    id: 'battle-mech',
    name: 'Battle Mech',
    faction: FACTION.MACHINE_CULT,
    kind: CARD_KIND.SHIP,
    cost: 5,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(4), scrapOwn()],
      [ABILITY_KIND.ALLY]: [draw(1)],
    },
  },
  {
    id: 'missile-mech',
    name: 'Missile Mech',
    faction: FACTION.MACHINE_CULT,
    kind: CARD_KIND.SHIP,
    cost: 6,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(6), destroyBase(false)],
      [ABILITY_KIND.ALLY]: [draw(1)],
    },
  },
  {
    id: 'mech-world',
    name: 'Mech World',
    faction: FACTION.MACHINE_CULT,
    kind: CARD_KIND.OUTPOST,
    cost: 5,
    defense: 6,
    abilities: {},
    passives: [{ type: PASSIVE_TYPE.ALL_FACTIONS }],
  },
  {
    id: 'junkyard',
    name: 'Junkyard',
    faction: FACTION.MACHINE_CULT,
    kind: CARD_KIND.OUTPOST,
    cost: 6,
    defense: 5,
    abilities: { [ABILITY_KIND.BASIC]: [scrapOwn()] },
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
  {
    id: 'brain-world',
    name: 'Brain World',
    faction: FACTION.MACHINE_CULT,
    kind: CARD_KIND.OUTPOST,
    cost: 8,
    defense: 6,
    // «Утилизируйте до двух карт из руки и/или сброса, возьмите по карте за каждую».
    abilities: {
      [ABILITY_KIND.BASIC]: [{ type: EFFECT_TYPE.SCRAP, from: [SCRAP_ZONE.HAND, SCRAP_ZONE.DISCARD], optional: true, repeat: 2, drawPerScrap: true }],
    },
  },

  // Звёздная империя
  {
    id: 'imperial-fighter',
    name: 'Imperial Fighter',
    faction: FACTION.STAR_EMPIRE,
    kind: CARD_KIND.SHIP,
    cost: 1,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(2), opponentDiscard(1)],
      [ABILITY_KIND.ALLY]: [combat(2)],
    },
  },
  {
    id: 'imperial-frigate',
    name: 'Imperial Frigate',
    faction: FACTION.STAR_EMPIRE,
    kind: CARD_KIND.SHIP,
    cost: 3,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(4), opponentDiscard(1)],
      [ABILITY_KIND.ALLY]: [combat(2)],
      [ABILITY_KIND.SCRAP]: [draw(1)],
    },
  },
  {
    id: 'survey-ship',
    name: 'Survey Ship',
    faction: FACTION.STAR_EMPIRE,
    kind: CARD_KIND.SHIP,
    cost: 3,
    abilities: {
      [ABILITY_KIND.BASIC]: [trade(1), draw(1)],
      [ABILITY_KIND.SCRAP]: [opponentDiscard(1)],
    },
  },
  {
    id: 'corvette',
    name: 'Corvette',
    faction: FACTION.STAR_EMPIRE,
    kind: CARD_KIND.SHIP,
    cost: 2,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(1), draw(1)],
      [ABILITY_KIND.ALLY]: [combat(2)],
    },
  },
  {
    id: 'battlecruiser',
    name: 'Battlecruiser',
    faction: FACTION.STAR_EMPIRE,
    kind: CARD_KIND.SHIP,
    cost: 6,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(5), draw(1)],
      [ABILITY_KIND.ALLY]: [opponentDiscard(1)],
      [ABILITY_KIND.SCRAP]: [draw(1), destroyBase(true)],
    },
  },
  {
    id: 'dreadnaught',
    name: 'Dreadnaught',
    faction: FACTION.STAR_EMPIRE,
    kind: CARD_KIND.SHIP,
    cost: 7,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(7), draw(1)],
      [ABILITY_KIND.SCRAP]: [combat(5)],
    },
  },
  {
    id: 'space-station',
    name: 'Space Station',
    faction: FACTION.STAR_EMPIRE,
    kind: CARD_KIND.OUTPOST,
    cost: 4,
    defense: 4,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(2)],
      [ABILITY_KIND.ALLY]: [combat(2)],
      [ABILITY_KIND.SCRAP]: [trade(4)],
    },
  },
  {
    id: 'recycling-station',
    name: 'Recycling Station',
    faction: FACTION.STAR_EMPIRE,
    kind: CARD_KIND.OUTPOST,
    cost: 4,
    defense: 4,
    abilities: { [ABILITY_KIND.BASIC]: [choice([trade(1)], [discardDraw(2)])] },
  },
  {
    id: 'war-world',
    name: 'War World',
    faction: FACTION.STAR_EMPIRE,
    kind: CARD_KIND.OUTPOST,
    cost: 5,
    defense: 4,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(3)],
      [ABILITY_KIND.ALLY]: [combat(4)],
    },
  },
  {
    id: 'royal-redoubt',
    name: 'Royal Redoubt',
    faction: FACTION.STAR_EMPIRE,
    kind: CARD_KIND.OUTPOST,
    cost: 6,
    defense: 6,
    abilities: {
      [ABILITY_KIND.BASIC]: [combat(3)],
      [ABILITY_KIND.ALLY]: [opponentDiscard(1)],
    },
  },
  {
    id: 'fleet-hq',
    name: 'Fleet HQ',
    faction: FACTION.STAR_EMPIRE,
    kind: CARD_KIND.BASE,
    cost: 8,
    defense: 8,
    abilities: {},
    // Каждый корабль, который вы играете, получает +1 к атаке.
    passives: [{ type: PASSIVE_TYPE.SHIP_COMBAT_BONUS, amount: 1 }],
  },
]

export const CARDS: Readonly<Record<string, Card>> = Object.fromEntries(cards.map(card => [card.id, card]))

export function getCard(cardId: string): Card {
  const card = CARDS[cardId]
  if (!card)
    throw new Error(`Unknown card definition: ${cardId}`)
  return card
}
