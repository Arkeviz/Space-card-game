import type { AbilityKind, CardKind, Effect, Faction, Resource, ScrapZone, ValueOf } from '@space/engine'
import type { IconName } from '@/common/ui/icons'
import { ABILITY_KIND, CARD_KIND, EFFECT_TYPE, FACTION, getCard, RESOURCE, SCRAP_ZONE } from '@space/engine'
import { circlePath, ICON } from '@/common/ui/icons'

/*
 * Оформление карт: русские названия, цвета и эмблемы фракций, разбор эффектов в токены для отрисовки.
 * Правила и числа берутся из каталога движка (getCard), здесь - только то, как они выглядят.
 */

/** Рабочий перевод названий. Движок хранит английские; нет перевода - показывается английское название. */
const CARD_NAME_RU: Readonly<Record<string, string>> = {
  'scout': 'Разведчик',
  'viper': 'Гадюка',
  'explorer': 'Исследователь',
  // Торговая федерация
  'federation-shuttle': 'Челнок Федерации',
  'cutter': 'Катер',
  'trading-post': 'Торговый пост',
  'barter-world': 'Мир бартера',
  // Слизь
  'blob-fighter': 'Слизень-истребитель',
  'battle-pod': 'Боевой кокон',
  'trade-pod': 'Торговый кокон',
  'blob-wheel': 'Колесо слизней',
  'ram': 'Таран',
  'blob-destroyer': 'Слизень-разрушитель',
  'the-hive': 'Улей',
  'battle-blob': 'Боевой слизень',
  'blob-carrier': 'Слизненосец',
  'mothership': 'Корабль-матка',
  'blob-world': 'Мир Слизней',
  // Технокульт
  'trade-bot': 'Торговый бот',
  'battle-station': 'Боевая станция',
  'machine-base': 'Машинная база',
  // Звёздная империя
  'imperial-fighter': 'Имперский истребитель',
  'corvette': 'Корвет',
  'royal-redoubt': 'Королевский редут',
}

export function cardName(cardId: string): string {
  return CARD_NAME_RU[cardId] ?? getCard(cardId).name
}

export interface FactionMeta {
  label: string
  /** Основной цвет (hex) и тот же цвет в виде "r,g,b" для rgba(). */
  color: string
  rgb: string
  /** SVG-путь эмблемы в сетке 24x24. */
  emblem: string
}

export const FACTION_META: Readonly<Record<Faction, FactionMeta>> = {
  [FACTION.NEUTRAL]: { label: 'НЕЙТРАЛЬНАЯ', color: '#A9B6CF', rgb: '169,182,207', emblem: `M5.5 5.5h13v13h-13z${circlePath(12, 12, 1.6)}` },
  [FACTION.TRADE_FEDERATION]: { label: 'ТОРГОВАЯ ФЕДЕРАЦИЯ', color: '#4C9BFF', rgb: '76,155,255', emblem: 'M12 3l9 9-9 9-9-9zM7.5 12h9' },
  [FACTION.BLOB]: {
    label: 'БЛОБ',
    color: '#8BD448',
    rgb: '139,212,72',
    emblem: `M12 4c4.4 0 7.5 2.6 7.5 6.6c0 2.8-1.8 3.8-1.8 6.1c0 2.6-2.6 4.3-5.7 4.3s-7-1.9-7-5.8c0-2.4 1.7-3.6 1.7-5.6C6.7 6.1 8 4 12 4z${circlePath(12, 12, 2)}`,
  },
  [FACTION.MACHINE_CULT]: { label: 'МАШИННЫЙ КУЛЬТ', color: '#FF6B4A', rgb: '255,107,74', emblem: `M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z${circlePath(12, 12, 3)}` },
  [FACTION.STAR_EMPIRE]: { label: 'ЗВЁЗДНАЯ ИМПЕРИЯ', color: '#F5D04A', rgb: '245,208,74', emblem: 'M12 2.5l2.4 7.1 7.1 2.4-7.1 2.4-2.4 7.1-2.4-7.1-7.1-2.4 7.1-2.4z' },
}

export const KIND_LABEL: Readonly<Record<CardKind, string>> = {
  [CARD_KIND.SHIP]: 'КОРАБЛЬ',
  [CARD_KIND.BASE]: 'БАЗА',
  [CARD_KIND.OUTPOST]: 'АВАНПОСТ',
}

export interface ResourceMeta {
  color: string
  rgb: string
  icon: IconName
  /** Родительный падеж для описаний: «+2 торговли». */
  genitive: string
}

export const RESOURCE_META: Readonly<Record<Resource, ResourceMeta>> = {
  [RESOURCE.TRADE]: { color: '#FFC23D', rgb: '255,194,61', icon: ICON.TRADE, genitive: 'торговли' },
  [RESOURCE.COMBAT]: { color: '#FF5A4F', rgb: '255,90,79', icon: ICON.COMBAT, genitive: 'атаки' },
  [RESOURCE.AUTHORITY]: { color: '#3FE0A0', rgb: '63,224,160', icon: ICON.AUTHORITY, genitive: 'авторитета' },
}

/** Состояние способности карты на столе. AUTO - показывается как обычно, без подсветки и приглушения. */
export const ABILITY_STATUS = {
  AUTO: 'auto',
  READY: 'ready',
  USED: 'used',
  OFF: 'off',
} as const
export type AbilityStatus = ValueOf<typeof ABILITY_STATUS>

/** Токен описания эффекта: чип «иконка + число», слово «ИЛИ» или текстовая строка с иконкой. */
export const TOKEN_KIND = {
  CHIP: 'chip',
  OR: 'or',
  TEXT: 'text',
} as const

export type EffectToken
  = | { kind: typeof TOKEN_KIND.CHIP, icon: IconName, color: string, rgb: string, value: string }
    | { kind: typeof TOKEN_KIND.OR }
    | { kind: typeof TOKEN_KIND.TEXT, icon: IconName, label: string }

const SCRAP_ZONE_LABEL: Readonly<Record<ScrapZone, string>> = {
  [SCRAP_ZONE.HAND]: 'руки',
  [SCRAP_ZONE.DISCARD]: 'сброса',
  [SCRAP_ZONE.TRADE_ROW]: 'торгового ряда',
}

export function scrapEffectLabel(from: readonly ScrapZone[], optional: boolean): string {
  const zones = from.map(zone => SCRAP_ZONE_LABEL[zone]).join(' или ')
  return `${optional ? 'Можете утилизировать' : 'Утилизируйте'} карту из ${zones}`
}

const NEUTRAL_CHIP = { color: '#D7E2FA', rgb: '215,226,250' }

export function effectTokens(effect: Effect): EffectToken[] {
  switch (effect.type) {
    case EFFECT_TYPE.GAIN: {
      const meta = RESOURCE_META[effect.resource]
      return [{ kind: TOKEN_KIND.CHIP, icon: meta.icon, color: meta.color, rgb: meta.rgb, value: `+${effect.amount}` }]
    }
    case EFFECT_TYPE.DRAW:
      return [{ kind: TOKEN_KIND.CHIP, icon: ICON.DRAW, ...NEUTRAL_CHIP, value: `+${effect.amount}` }]
    case EFFECT_TYPE.OPPONENT_DISCARD:
      return [{ kind: TOKEN_KIND.TEXT, icon: ICON.OPPONENT_DISCARD, label: effect.amount > 1 ? `Соперник сбрасывает карты: ${effect.amount}` : 'Соперник сбрасывает карту' }]
    case EFFECT_TYPE.SCRAP:
      return [{ kind: TOKEN_KIND.TEXT, icon: ICON.SCRAP, label: scrapEffectLabel(effect.from, effect.optional) }]
    case EFFECT_TYPE.CHOICE:
      return effect.options.flatMap((option, index) => [
        ...(index > 0 ? [{ kind: TOKEN_KIND.OR } as const] : []),
        ...option.flatMap(effectTokens),
      ])
  }
}

/** Одна строка способностей на карте. */
export interface AbilityRow {
  kind: AbilityKind
  chips: EffectToken[]
  /** Текстовые токены: рядом с чипами их нет - идут в строку, иначе под ними. */
  texts: EffectToken[]
}

const ABILITY_ORDER: readonly AbilityKind[] = [ABILITY_KIND.BASIC, ABILITY_KIND.ALLY, ABILITY_KIND.SCRAP]

export function abilityRows(cardId: string): AbilityRow[] {
  const { abilities } = getCard(cardId)
  const rows: AbilityRow[] = []
  for (const kind of ABILITY_ORDER) {
    const effects = abilities[kind]
    if (!effects)
      continue
    const tokens = effects.flatMap(effectTokens)
    rows.push({
      kind,
      chips: tokens.filter(token => token.kind !== TOKEN_KIND.TEXT),
      texts: tokens.filter(token => token.kind === TOKEN_KIND.TEXT),
    })
  }
  return rows
}

/** Короткое текстовое описание карты для aria-label и журнала. */
export function describeEffectShort(effect: Effect): string {
  switch (effect.type) {
    case EFFECT_TYPE.GAIN:
      return `+${effect.amount} ${RESOURCE_META[effect.resource].genitive}`
    case EFFECT_TYPE.DRAW:
      return effect.amount === 1 ? '+1 карта' : `+${effect.amount} карты`
    case EFFECT_TYPE.OPPONENT_DISCARD:
      return 'соперник сбрасывает карту'
    case EFFECT_TYPE.SCRAP:
      return scrapEffectLabel(effect.from, effect.optional).toLowerCase()
    case EFFECT_TYPE.CHOICE:
      return effect.options.map(option => option.map(describeEffectShort).join(', ')).join(' или ')
  }
}
