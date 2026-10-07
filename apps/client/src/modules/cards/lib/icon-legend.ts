import type { IconName } from '@/common/ui/icons'
import { RESOURCE } from '@space/engine'
import { ICON } from '@/common/ui/icons'
import { NEUTRAL_CHIP, RESOURCE_META } from './card-meta'

/*
 * Условные обозначения для справки: каждый значок, который встречается на картах, с пояснением.
 * Значки берутся те же, что рисует CardView (ICON.*), здесь только описание.
 */

/** Как рисуется образец значка в справке. */
export const LEGEND_SAMPLE = {
  /** Значок эффекта в рамке, как на карте (число необязательно). */
  CHIP: 'chip',
  /** Значок слева в строке способности: утилизация этой карты. */
  PREFIX: 'prefix',
  /** Эмблемы фракций. */
  EMBLEMS: 'emblems',
  /** Защита базы: щит с числом. */
  DEFENSE: 'defense',
  /** Отметка состояния способности. */
  MARK: 'mark',
} as const

export type LegendSample
  = | { kind: typeof LEGEND_SAMPLE.CHIP, icon: IconName, color: string, rgb: string, value?: string, iconless?: boolean }
    | { kind: typeof LEGEND_SAMPLE.PREFIX, icon: IconName }
    | { kind: typeof LEGEND_SAMPLE.EMBLEMS }
    | { kind: typeof LEGEND_SAMPLE.DEFENSE }
    | { kind: typeof LEGEND_SAMPLE.MARK, icon: IconName, color: string }

export interface LegendEntry {
  sample: LegendSample
  title: string
  text: string
}

export interface LegendGroup {
  id: string
  title: string
  entries: LegendEntry[]
}

function resource(kind: typeof RESOURCE.TRADE | typeof RESOURCE.COMBAT | typeof RESOURCE.AUTHORITY): LegendSample {
  const meta = RESOURCE_META[kind]
  return { kind: LEGEND_SAMPLE.CHIP, icon: meta.icon, color: meta.color, rgb: meta.rgb, value: '+2', iconless: true }
}

const neutral = (icon: IconName, value?: string): LegendSample => ({ kind: LEGEND_SAMPLE.CHIP, icon, ...NEUTRAL_CHIP, value })

export const ICON_LEGEND: readonly LegendGroup[] = [
  {
    id: 'resources',
    title: 'Ресурсы и карты',
    entries: [
      { sample: resource(RESOURCE.TRADE), title: 'Торговля', text: 'Тратится на покупку карт. Число - сколько торговли вы получаете. К концу хода сгорает.' },
      { sample: resource(RESOURCE.COMBAT), title: 'Атака', text: 'Бьёт по сопернику и его базам. К концу хода сгорает.' },
      { sample: resource(RESOURCE.AUTHORITY), title: 'Авторитет', text: 'Ваше здоровье: растёт на указанное число.' },
      { sample: neutral(ICON.DRAW, '+1'), title: 'Возьмите карты', text: 'Возьмите из колоды столько карт, сколько указано. «+X» - по карте за каждую карту, условие написано под значком (например, за каждого сыгранного слизня).' },
      { sample: neutral(ICON.BASE), title: 'База', text: 'База или аванпост на вашем столе. Встречается в условиях: «+2 карты, если от 2 баз».' },
    ],
  },
  {
    id: 'opponent',
    title: 'Против соперника',
    entries: [
      { sample: neutral(ICON.OPPONENT_DISCARD, '1'), title: 'Соперник сбрасывает карту', text: 'Число - сколько карт. Соперник сбрасывает их в начале своего хода, после того как возьмёт руку.' },
      { sample: neutral(ICON.DESTROY_BASE), title: 'Уничтожить базу соперника', text: 'Уничтожает любую его базу или аванпост без затрат атаки. Аванпосты от этого эффекта не защищают.' },
    ],
  },
  {
    id: 'deck',
    title: 'Колода, рынок и утиль',
    entries: [
      { sample: neutral(ICON.SCRAP, '1'), title: 'Утилизировать карту', text: 'Число - сколько карт; откуда (из руки, из сброса) написано под значком. Утилизированная карта уходит в утиль навсегда. Утилизированный Исследователь возвращается в свою стопку.' },
      { sample: neutral(ICON.SCRAP_TRADE_ROW), title: 'Утилизировать карту из торгового ряда', text: 'Выберите любую карту торгового ряда: она уходит в утиль, на её место выкладывается новая.' },
      { sample: neutral(ICON.DISCARD_DRAW, '2'), title: 'Сбросить и взять', text: 'Сбросьте до указанного числа карт из руки и возьмите столько же.' },
      { sample: neutral(ICON.DECK_TOP), title: 'Следующий купленный корабль - на верх колоды', text: 'Корабль, который вы купите следующим в этот ход, ляжет на верх вашей колоды, а не в сброс.' },
      { sample: neutral(ICON.ACQUIRE_SHIP), title: 'Получить корабль бесплатно', text: 'Выберите любой корабль торгового ряда или Исследователя: он достаётся вам бесплатно и ложится на верх колоды.' },
    ],
  },
  {
    id: 'abilities',
    title: 'Способности и защита',
    entries: [
      { sample: { kind: LEGEND_SAMPLE.EMBLEMS }, title: 'Способность союзника', text: 'Строка с эмблемой фракции срабатывает, если на вашем столе есть другая карта этой фракции.' },
      { sample: { kind: LEGEND_SAMPLE.PREFIX, icon: ICON.SCRAP }, title: 'Утилизация этой карты', text: 'Строка с корзиной: уберите эту карту из игры навсегда, чтобы получить эффект.' },
      { sample: { kind: LEGEND_SAMPLE.DEFENSE }, title: 'Защита', text: 'Столько атаки нужно потратить, чтобы уничтожить базу. У аванпоста значок залит: пока он стоит, бить по игроку и другим базам нельзя.' },
      { sample: { kind: LEGEND_SAMPLE.MARK, icon: ICON.ARROW, color: 'var(--c-me)' }, title: 'Можно активировать', text: 'Способность готова: карта светится голубым, строка способности залита, над картой метка «АКТИВИРОВАТЬ». Нажмите на карту.' },
      { sample: { kind: LEGEND_SAMPLE.MARK, icon: ICON.CHECK, color: 'var(--c-muted)' }, title: 'Использовано', text: 'Способность уже сработала в этот ход.' },
    ],
  },
]
