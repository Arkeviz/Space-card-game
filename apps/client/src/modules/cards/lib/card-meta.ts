import type { AbilityKind, CardKind, Effect, Faction, Passive, Resource, ScrapZone, ValueOf } from '@space/engine'
import type { IconName } from '@/common/ui/icons'
import { ABILITY_KIND, CARD_KIND, EFFECT_TYPE, FACTION, getCard, PASSIVE_TYPE, RESOURCE, SCRAP_ZONE } from '@space/engine'
import { circlePath, ICON } from '@/common/ui/icons'

/*
 * Оформление карт: русские названия, цвета и эмблемы фракций, разбор эффектов в токены для отрисовки.
 * Правила и числа берутся из каталога движка (getCard), здесь - только то, как они выглядят.
 */

/** Рабочий перевод названий. Движок хранит английские; нет перевода - показывается английское название. */
const CARD_NAME_RU: Readonly<Record<string, string>> = {
  'scout': 'Разведчик',
  'viper': 'Штурмовик',
  'explorer': 'Исследователь',
  // Торговая федерация
  'federation-shuttle': 'Челнок Федерации',
  'cutter': 'Катер',
  'embassy-yacht': 'Посольская яхта',
  'trading-post': 'Торговый пост',
  'barter-world': 'Рыночный мир',
  'freighter': 'Грузовой корабль',
  'defense-center': 'Опорный пункт',
  'trade-escort': 'Сторожевой корабль',
  'flagship': 'Флагман',
  'port-of-call': 'Космопорт',
  'central-office': 'Центральное управление',
  'command-ship': 'Командный корабль',
  // Слизни
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
  'blob-world': 'Мир слизней',
  // Технокульт
  'trade-bot': 'Торговый бот',
  'missile-bot': 'Ракетный бот',
  'battle-station': 'Боевая станция',
  'supply-bot': 'Бот снабжения',
  'patrol-mech': 'Патрульный космотанк',
  'stealth-needle': 'Игла',
  'battle-mech': 'Боевой танк',
  'mech-world': 'Техномир',
  'junkyard': 'Свалка металлолома',
  'missile-mech': 'Ракетный космотанк',
  'machine-base': 'Технобаза',
  'brain-world': 'Мозгомир',
  // Звёздная империя
  'imperial-fighter': 'Имперский истребитель',
  'corvette': 'Корвет',
  'imperial-frigate': 'Имперский фрегат',
  'survey-ship': 'Научный корабль',
  'recycling-station': 'Станция переработки',
  'space-station': 'Космическая станция',
  'war-world': 'Военный мир',
  'battlecruiser': 'Боевой крейсер',
  'royal-redoubt': 'Имперская цитадель',
  'dreadnaught': 'Дредноут',
  'fleet-hq': 'Ставка командования',
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
    label: 'СЛИЗНИ',
    color: '#8BD448',
    rgb: '139,212,72',
    emblem: `M12 4c4.4 0 7.5 2.6 7.5 6.6c0 2.8-1.8 3.8-1.8 6.1c0 2.6-2.6 4.3-5.7 4.3s-7-1.9-7-5.8c0-2.4 1.7-3.6 1.7-5.6C6.7 6.1 8 4 12 4z${circlePath(12, 12, 2)}`,
  },
  [FACTION.MACHINE_CULT]: { label: 'ТЕХНОКУЛЬТ', color: '#FF6B4A', rgb: '255,107,74', emblem: `M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z${circlePath(12, 12, 3)}` },
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

/**
 * Токен описания эффекта: чип «иконка + число» (число может отсутствовать), слово «ИЛИ», текстовая строка
 * (иконка необязательна) или строка из слов и иконок («+2 [карта] если от 2 [база]»).
 * label - полное описание словами: подсказка при наведении и текст для скринридера.
 */
export const TOKEN_KIND = {
  CHIP: 'chip',
  OR: 'or',
  TEXT: 'text',
  LINE: 'line',
} as const

/** Часть строки LINE: слово или иконка. */
export type LinePart = { text: string } | { icon: IconName }

export type EffectToken
  = | { kind: typeof TOKEN_KIND.CHIP, icon: IconName, color: string, rgb: string, value?: string, label: string, iconless?: boolean }
    | { kind: typeof TOKEN_KIND.OR }
    | { kind: typeof TOKEN_KIND.TEXT, icon?: IconName, label: string }
    | { kind: typeof TOKEN_KIND.LINE, parts: LinePart[], label: string }

const SCRAP_ZONE_LABEL: Readonly<Record<ScrapZone, string>> = {
  [SCRAP_ZONE.HAND]: 'руки',
  [SCRAP_ZONE.DISCARD]: 'сброса',
  [SCRAP_ZONE.TRADE_ROW]: 'торгового ряда',
}

/** «из руки или сброса»: откуда утилизируется карта. */
function scrapSource(from: readonly ScrapZone[]): string {
  return `из ${from.map(zone => SCRAP_ZONE_LABEL[zone]).join(' или ')}`
}

/** Что взять за каждую сыгранную карту фракции: «за каждого сыгранного слизня». */
const PER_PLAYED_LABEL: Readonly<Record<Faction, string>> = {
  [FACTION.NEUTRAL]: 'за каждую сыгранную нейтральную карту',
  [FACTION.TRADE_FEDERATION]: 'за каждую сыгранную карту Торговой федерации',
  [FACTION.BLOB]: 'за каждого сыгранного слизня',
  [FACTION.MACHINE_CULT]: 'за каждую сыгранную карту Технокульта',
  [FACTION.STAR_EMPIRE]: 'за каждую сыгранную карту Звёздной империи',
}

export function scrapEffectLabel(from: readonly ScrapZone[], optional: boolean, repeat = 1, drawPerScrap = false): string {
  const zones = from.map(zone => SCRAP_ZONE_LABEL[zone]).join(' или ')
  const what = repeat > 1 ? `до ${repeat} карт` : 'карту'
  const verb = optional ? (repeat > 1 ? 'Утилизируйте' : 'Можете утилизировать') : 'Утилизируйте'
  return `${verb} ${what} из ${zones}${drawPerScrap ? ', берите по карте за каждую' : ''}`
}

/** Фракции в родительном падеже: «за каждую сыгранную карту слизней». */
const FACTION_GENITIVE: Readonly<Record<Faction, string>> = {
  [FACTION.NEUTRAL]: 'нейтральных',
  [FACTION.TRADE_FEDERATION]: 'Торговой федерации',
  [FACTION.BLOB]: 'слизней',
  [FACTION.MACHINE_CULT]: 'Технокульта',
  [FACTION.STAR_EMPIRE]: 'Звёздной империи',
}

function cardsWord(amount: number): string {
  return amount === 1 ? 'карту' : amount < 5 ? 'карты' : 'карт'
}

/** Предложение для эффектов, которые нельзя показать чипом «иконка и число»: способности с выбором и особыми правилами. */
function textEffect(effect: Effect): { icon: IconName, label: string } | null {
  switch (effect.type) {
    case EFFECT_TYPE.OPPONENT_DISCARD:
      return { icon: ICON.OPPONENT_DISCARD, label: effect.amount > 1 ? `Соперник сбрасывает карты: ${effect.amount}` : 'Соперник сбрасывает карту' }
    case EFFECT_TYPE.SCRAP:
      return { icon: ICON.SCRAP, label: scrapEffectLabel(effect.from, effect.optional, effect.repeat, effect.drawPerScrap) }
    case EFFECT_TYPE.DESTROY_BASE:
      return { icon: ICON.SHIELD, label: effect.optional ? 'Можете уничтожить базу соперника' : 'Уничтожьте базу соперника' }
    case EFFECT_TYPE.ACQUIRE_SHIP:
      return { icon: ICON.SHIP, label: 'Получите любой корабль бесплатно, он ляжет на верх колоды' }
    case EFFECT_TYPE.SHIP_TO_DECK_TOP:
      return { icon: ICON.SHIP, label: 'Следующий купленный корабль ляжет на верх колоды' }
    case EFFECT_TYPE.DRAW_IF_BASES:
      return { icon: ICON.DRAW, label: `Возьмите ${effect.amount} ${cardsWord(effect.amount)}, если у вас ${effect.minBases}+ баз` }
    case EFFECT_TYPE.DRAW_PER_PLAYED:
      return { icon: ICON.DRAW, label: `Возьмите по карте за каждую сыгранную карту ${FACTION_GENITIVE[effect.faction]}` }
    case EFFECT_TYPE.DISCARD_DRAW:
      return { icon: ICON.DISCARD_DRAW, label: `Сбросьте до ${effect.max} карт и возьмите столько же` }
    case EFFECT_TYPE.COPY_SHIP:
      return { icon: ICON.SHIP, label: 'Скопируйте другой корабль, сыгранный в этот ход' }
    default:
      return null
  }
}

export const NEUTRAL_CHIP = { color: '#D7E2FA', rgb: '215,226,250' }

/** Полное описание эффекта словами: подсказка к значку и текст для скринридера. */
function effectLabel(effect: Effect): string {
  switch (effect.type) {
    case EFFECT_TYPE.GAIN:
      return `+${effect.amount} ${RESOURCE_META[effect.resource].genitive}`
    case EFFECT_TYPE.DRAW:
      return `Возьмите ${effect.amount} ${cardsWord(effect.amount)}`
    default:
      return textEffect(effect)?.label ?? ''
  }
}

const chip = (icon: IconName, label: string, value?: string): EffectToken => ({ kind: TOKEN_KIND.CHIP, icon, ...NEUTRAL_CHIP, value, label })

/**
 * Эффект как токены для карты. Простые эффекты - значок (с числом, если оно есть); способности с условием или
 * пояснением получают ещё строку текста: откуда утилизировать, за что брать карты.
 */
export function effectTokens(effect: Effect): EffectToken[] {
  const label = effectLabel(effect)
  switch (effect.type) {
    case EFFECT_TYPE.GAIN: {
      const meta = RESOURCE_META[effect.resource]
      return [{ kind: TOKEN_KIND.CHIP, icon: meta.icon, color: meta.color, rgb: meta.rgb, value: `+${effect.amount}`, label, iconless: true }]
    }
    case EFFECT_TYPE.DRAW:
      return [chip(ICON.DRAW, label, `+${effect.amount}`)]
    case EFFECT_TYPE.CHOICE:
      return effect.options.flatMap((option, index) => [
        ...(index > 0 ? [{ kind: TOKEN_KIND.OR } as const] : []),
        ...option.flatMap(effectTokens),
      ])
    case EFFECT_TYPE.OPPONENT_DISCARD:
      return [chip(ICON.OPPONENT_DISCARD, label, String(effect.amount))]
    case EFFECT_TYPE.SCRAP: {
      // Утилизация из торгового ряда - отдельный значок без числа и пояснений.
      if (effect.from.length === 1 && effect.from[0] === SCRAP_ZONE.TRADE_ROW)
        return [chip(ICON.SCRAP_TRADE_ROW, label)]
      const caption = effect.drawPerScrap
        ? 'Возьмите карту за каждую утилизированную'
        : `${scrapSource(effect.from)}${effect.optional ? '' : ' (обязательно)'}`
      return [chip(ICON.SCRAP, label, String(effect.repeat ?? 1)), { kind: TOKEN_KIND.TEXT, label: caption }]
    }
    case EFFECT_TYPE.DESTROY_BASE:
      return [chip(ICON.DESTROY_BASE, label)]
    case EFFECT_TYPE.ACQUIRE_SHIP:
      return [chip(ICON.ACQUIRE_SHIP, label)]
    case EFFECT_TYPE.SHIP_TO_DECK_TOP:
      return [chip(ICON.DECK_TOP, label)]
    case EFFECT_TYPE.DRAW_IF_BASES:
      return [{
        kind: TOKEN_KIND.LINE,
        parts: [{ text: `+${effect.amount}` }, { icon: ICON.DRAW }, { text: `если от ${effect.minBases}` }, { icon: ICON.BASE }],
        label,
      }]
    case EFFECT_TYPE.DRAW_PER_PLAYED:
      return [chip(ICON.DRAW, label, '+X'), { kind: TOKEN_KIND.TEXT, label: PER_PLAYED_LABEL[effect.faction] }]
    case EFFECT_TYPE.DISCARD_DRAW:
      return [chip(ICON.DISCARD_DRAW, label, String(effect.max))]
    default: {
      const text = textEffect(effect)
      return text ? [{ kind: TOKEN_KIND.TEXT, icon: text.icon, label: text.label }] : []
    }
  }
}

/** Одна строка способностей на карте. */
export interface AbilityRow {
  kind: AbilityKind
  /** Значки (и слово «ИЛИ» между вариантами). */
  chips: EffectToken[]
  /** Текстовые токены и строки с иконками: рядом с чипами их нет - идут в строку, иначе под ними. */
  texts: EffectToken[]
}

const ABILITY_ORDER: readonly AbilityKind[] = [ABILITY_KIND.BASIC, ABILITY_KIND.ALLY, ABILITY_KIND.SCRAP]

function passiveLabel(passive: Passive): string {
  switch (passive.type) {
    case PASSIVE_TYPE.ALL_FACTIONS:
      return 'Считается союзником для всех фракций'
    case PASSIVE_TYPE.SHIP_COMBAT_BONUS:
      return `Каждый ваш корабль получает +${passive.amount} атаки`
  }
}

/** Постоянные свойства карты в виде коротких предложений (способности без активации). */
export function passiveLabels(cardId: string): string[] {
  return (getCard(cardId).passives ?? []).map(passiveLabel)
}

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
      chips: tokens.filter(token => token.kind === TOKEN_KIND.CHIP || token.kind === TOKEN_KIND.OR),
      texts: tokens.filter(token => token.kind === TOKEN_KIND.TEXT || token.kind === TOKEN_KIND.LINE),
    })
  }
  return rows
}

/** Короткое текстовое описание эффекта для aria-label и журнала. */
export function describeEffectShort(effect: Effect): string {
  switch (effect.type) {
    case EFFECT_TYPE.GAIN:
      return `+${effect.amount} ${RESOURCE_META[effect.resource].genitive}`
    case EFFECT_TYPE.DRAW:
      return effect.amount === 1 ? '+1 карта' : `+${effect.amount} карты`
    case EFFECT_TYPE.CHOICE:
      return effect.options.map(option => option.map(describeEffectShort).join(', ')).join(' или ')
    default:
      return (textEffect(effect)?.label ?? '').toLowerCase()
  }
}
