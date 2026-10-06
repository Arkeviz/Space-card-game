import type { ValueOf } from '@space/engine'

/** Форма карты: карточка (рука, рынок, сброс), развёрнутая база на поле, рубашка. */
export const CARD_FORM = {
  CARD: 'card',
  DEPLOYED: 'deployed',
  BACK: 'back',
} as const
export type CardForm = ValueOf<typeof CARD_FORM>

/** Размеры карты в натуральную величину (логические пиксели сцены). */
export const CARD_SIZE = {
  CARD: { w: 200, h: 280 },
  DEPLOYED: { w: 280, h: 200 },
} as const

/** Состояние рамки и подсветки карты. */
export const CARD_STATE = {
  IDLE: 'idle',
  HOVER: 'hover',
  AFFORDABLE: 'affordable',
  UNAFFORDABLE: 'unaffordable',
  SELECTABLE: 'selectable',
  SELECTED: 'selected',
  TARGET: 'target',
  LOCKED: 'locked',
  DIM: 'dim',
} as const
export type CardVisualState = ValueOf<typeof CARD_STATE>

export function frameColor(state: CardVisualState, factionRgb: string): string {
  switch (state) {
    case CARD_STATE.IDLE: return `rgba(${factionRgb},0.55)`
    case CARD_STATE.HOVER: return '#4FD8FF'
    case CARD_STATE.SELECTABLE: return 'rgba(79,216,255,0.7)'
    case CARD_STATE.SELECTED: return '#4FD8FF'
    case CARD_STATE.AFFORDABLE: return '#FFC23D'
    case CARD_STATE.UNAFFORDABLE: return `rgba(${factionRgb},0.3)`
    case CARD_STATE.TARGET: return '#FF5A4F'
    case CARD_STATE.LOCKED: return 'rgba(169,182,207,0.35)'
    case CARD_STATE.DIM: return `rgba(${factionRgb},0.4)`
  }
}

const BASE_SHADOW = 'drop-shadow(0 6px 14px rgba(0,0,0,0.55))'

export function glowFilter(state: CardVisualState): string {
  switch (state) {
    case CARD_STATE.IDLE:
    case CARD_STATE.UNAFFORDABLE:
      return BASE_SHADOW
    case CARD_STATE.HOVER: return 'drop-shadow(0 0 14px rgba(79,216,255,0.55)) drop-shadow(0 14px 22px rgba(0,0,0,0.6))'
    case CARD_STATE.SELECTABLE: return 'drop-shadow(0 0 8px rgba(79,216,255,0.28))'
    case CARD_STATE.SELECTED: return 'drop-shadow(0 0 16px rgba(79,216,255,0.65))'
    case CARD_STATE.AFFORDABLE: return 'drop-shadow(0 0 12px rgba(255,194,61,0.45))'
    case CARD_STATE.TARGET: return 'drop-shadow(0 0 14px rgba(255,90,79,0.6))'
    case CARD_STATE.LOCKED:
    case CARD_STATE.DIM:
      return 'none'
  }
}
