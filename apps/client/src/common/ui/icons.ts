import type { ValueOf } from '@space/engine'

/** Окружность как фрагмент SVG-пути: в наборе иконок из дизайна нет готовых `<circle>`, всё рисуется одним `<path>`. */
export function circlePath(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`
}

/** Имена иконок. Значения - ключи в ICON_PATHS; используются через ICON.X, а не строками. */
export const ICON = {
  TRADE: 'trade',
  COMBAT: 'combat',
  AUTHORITY: 'authority',
  DRAW: 'draw',
  OPPONENT_DISCARD: 'opponent-discard',
  SCRAP: 'scrap',
  SHIELD: 'shield',
  LOCK: 'lock',
  CHECK: 'check',
  ARROW: 'arrow',
  SHIP: 'ship',
  LOGO: 'logo',
  CLOCK: 'clock',
  MENU: 'menu',
  USER: 'user',
  INFO: 'info',
  COPY: 'copy',
  PLUS: 'plus',
  BACK: 'back',
  FLAG: 'flag',
  HOME: 'home',
  SCRAP_TRADE_ROW: 'scrap-trade-row',
  DESTROY_BASE: 'destroy-base',
  BASE: 'base',
  DECK_TOP: 'deck-top',
  ACQUIRE_SHIP: 'acquire-ship',
  DISCARD_DRAW: 'discard-draw',
} as const
export type IconName = ValueOf<typeof ICON>

const BASE_PATH = 'M4 20.5V8h3.5v2.5H10V8h4v2.5h2.5V8H20v12.5zM10.5 20.5v-4.5h3v4.5'

/** Все иконки нарисованы в сетке 24x24, обводкой (stroke), без заливки. */
export const ICON_PATHS: Record<IconName, string> = {
  [ICON.TRADE]: `${circlePath(12, 12, 8.5)}M8.5 8.5h7M12 8.5v8`,
  [ICON.COMBAT]: `${circlePath(12, 12, 6)}M12 2.5v5.5M12 16v5.5M2.5 12h5.5M16 12h5.5`,
  [ICON.AUTHORITY]: 'M5 11.5l7-5 7 5M5 17.5l7-5 7 5',
  [ICON.DRAW]: 'M6.5 3.5h11v17h-11zM12 9v6M9 12h6',
  [ICON.OPPONENT_DISCARD]: 'M6.5 3.5h11v10h-11zM12 15.5v5M9.5 18.2l2.5 2.5l2.5-2.5',
  [ICON.SCRAP]: 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 11v5.5M13.5 11v5.5',
  [ICON.SHIELD]: 'M12 2.8l7.8 3.1v5.6c0 4.6-3.3 8.2-7.8 9.7c-4.5-1.5-7.8-5.1-7.8-9.7V5.9z',
  [ICON.LOCK]: 'M5.5 11h13v9.5h-13zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  [ICON.CHECK]: 'M5 12.5l4.5 4.5L19 7.5',
  [ICON.ARROW]: 'M9 6l6 6-6 6',
  [ICON.SHIP]: 'M12 2.5l5.5 16-5.5-3.2-5.5 3.2zM12 15.3v6',
  [ICON.LOGO]: `${circlePath(12, 12, 9.5)}M12 4.5l1.9 5.6 5.6 1.9-5.6 1.9-1.9 5.6-1.9-5.6-5.6-1.9 5.6-1.9z`,
  [ICON.CLOCK]: `${circlePath(12, 12, 8.5)}M12 7.5V12l3 2`,
  [ICON.MENU]: 'M4 7h16M4 12h16M4 17h16',
  [ICON.USER]: `${circlePath(12, 8.5, 3.5)}M5 20c1.2-3.6 3.9-5.5 7-5.5s5.8 1.9 7 5.5`,
  [ICON.INFO]: `${circlePath(12, 12, 8.5)}M12 11v5.5M12 7.8v0.4`,
  [ICON.COPY]: 'M9 9h11v11H9zM5 15V4h11',
  [ICON.PLUS]: 'M12 5v14M5 12h14',
  [ICON.BACK]: 'M15 6l-6 6 6 6',
  [ICON.FLAG]: 'M6 21V4M6 5h11l-2.5 4L17 13H6',
  [ICON.HOME]: 'M3.5 11.5L12 4l8.5 7.5M6 10v10h12V10M10 20v-5.5h4V20',
  [ICON.SCRAP_TRADE_ROW]: 'M1 6h6.5v12H1zM11 6h6.5v12H11zM21 6h6.5v12H21z',
  [ICON.DESTROY_BASE]: BASE_PATH,
  [ICON.BASE]: BASE_PATH,
  [ICON.DECK_TOP]: 'M12 2.5v6.5M9.3 6.5L12 9.2l2.7-2.7M5.5 12.5h13v3.5h-13zM5.5 16h13v3.5h-13z',
  [ICON.ACQUIRE_SHIP]: 'M12 10.5l-3.5-8l3.5 1.8l3.5-1.8zM5.5 12.5h13v3.5h-13zM5.5 16h13v3.5h-13z',
  [ICON.DISCARD_DRAW]: 'M6.5 3.5h11v17h-11zM9.5 9h5.5M13 6.8l2.2 2.2L13 11.2M14.5 15H9M11 12.8L8.8 15l2.2 2.2',
}

/** Вторая линия иконки красного цвета (цвет атаки), поверх основной: уничтожение базы - база, перечёркнутая красным крестом; утилизация из торгового ряда - три карты, средняя перечёркнута крестом. */
export const ICON_ACCENT_PATHS: Partial<Record<IconName, string>> = {
  [ICON.DESTROY_BASE]: 'M3.5 4l17 16.5M20.5 4L3.5 20.5',
  [ICON.SCRAP_TRADE_ROW]: 'M10.5 5l7.5 14M18 5l-7.5 14',
}

/** Ширина сетки иконки, если она шире стандартных 24 (высота всегда 24): три карты ряда не умещаются в квадрат. */
export const ICON_GRID_WIDTH: Partial<Record<IconName, number>> = {
  [ICON.SCRAP_TRADE_ROW]: 28.5,
}
