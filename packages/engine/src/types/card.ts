import type { AbilityKind, CardKind, CardSet, EFFECT_TYPE, Faction, PASSIVE_TYPE, Resource, ScrapZone } from './constants.ts'

/** Описание эффекта карты. Эффекты выполняются по порядку; часть из них требует выбора игрока (prompt). */
export type Effect
  = | { type: typeof EFFECT_TYPE.GAIN, resource: Resource, amount: number }
    | { type: typeof EFFECT_TYPE.DRAW, amount: number }
  /** Соперник сам выбирает и сбрасывает карты из руки. */
    | { type: typeof EFFECT_TYPE.OPPONENT_DISCARD, amount: number }
  /**
   * Утилизация карты из указанных зон. Если кандидатов нет, эффект пропускается. repeat - сколько карт можно
   * утилизировать подряд (по умолчанию одну), drawPerScrap - брать карту за каждую утилизированную.
   */
    | { type: typeof EFFECT_TYPE.SCRAP, from: ScrapZone[], optional: boolean, repeat?: number, drawPerScrap?: boolean }
  /** Игрок выбирает один из вариантов. */
    | { type: typeof EFFECT_TYPE.CHOICE, options: Effect[][] }
    | { type: typeof EFFECT_TYPE.DESTROY_BASE, optional: boolean }
    | { type: typeof EFFECT_TYPE.ACQUIRE_SHIP }
    | { type: typeof EFFECT_TYPE.SHIP_TO_DECK_TOP }
    | { type: typeof EFFECT_TYPE.DRAW_IF_BASES, minBases: number, amount: number }
    | { type: typeof EFFECT_TYPE.DRAW_PER_PLAYED, faction: Faction }
    | { type: typeof EFFECT_TYPE.DISCARD_DRAW, max: number }
    | { type: typeof EFFECT_TYPE.COPY_SHIP }

export type Passive
  = | { type: typeof PASSIVE_TYPE.ALL_FACTIONS }
    | { type: typeof PASSIVE_TYPE.SHIP_COMBAT_BONUS, amount: number }

export interface Card {
  id: string
  name: string
  /** Набор карт; в описаниях каталога можно не указывать, тогда это базовый набор. */
  set: CardSet
  faction: Faction
  kind: CardKind
  cost: number
  /** Только для баз и аванпостов. */
  defense?: number
  /**
   * basic: у кораблей срабатывает при розыгрыше, у баз активируется командой ACTIVATE.
   * ally: доступна, пока в игре есть другая карта той же фракции.
   * scrap: карта уходит в свалку, эффект срабатывает.
   */
  abilities: Partial<Record<AbilityKind, Effect[]>>
  /** Постоянные свойства, работающие, пока карта на столе. */
  passives?: Passive[]
}

/** Конкретная карта на столе. id стабилен всю партию и присваивается до перемешивания. */
export interface CardInstance {
  id: string
  cardId: string
}
