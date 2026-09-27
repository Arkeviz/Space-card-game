import type { AbilityKind, CardKind, EFFECT_TYPE, Faction, Resource, ScrapZone } from './constants.ts'

/** Описание эффекта карты. Эффекты выполняются по порядку; часть из них требует выбора игрока (prompt). */
export type Effect
  = | { type: typeof EFFECT_TYPE.GAIN, resource: Resource, amount: number }
    | { type: typeof EFFECT_TYPE.DRAW, amount: number }
  /** Соперник сам выбирает и сбрасывает карты из руки. */
    | { type: typeof EFFECT_TYPE.OPPONENT_DISCARD, amount: number }
  /** Утилизация одной карты из указанных зон. Если кандидатов нет, эффект пропускается. */
    | { type: typeof EFFECT_TYPE.SCRAP, from: ScrapZone[], optional: boolean }
  /** Игрок выбирает один из вариантов. */
    | { type: typeof EFFECT_TYPE.CHOICE, options: Effect[][] }

export interface Card {
  id: string
  name: string
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
}

/** Конкретная карта на столе. id стабилен всю партию и присваивается до перемешивания. */
export interface CardInstance {
  id: string
  cardId: string
}
