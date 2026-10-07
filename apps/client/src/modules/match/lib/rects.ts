/*
 * Сетка сцены 1920x1080 в логических пикселях: колонки 252 / 1336 / 256 с зазором 18 и отступами 20,
 * строки 84 / 196 / 262 / 196 / остаток с зазором 12. Числа перенесены из дизайна (артборд «Игровое поле»).
 * Панелей, колод и журнала это касается напрямую; поля и торговый ряд зависят от того, чей ход (fieldRects).
 * Одни и те же прямоугольники используют HUD (панели) и Board (зоны, позиции карт).
 */

export const STAGE = { w: 1920, h: 1080 } as const

export interface Rect { x: number, y: number, w: number, h: number }

export const RECT = {
  /** Левая колонка: колода и сброс соперника, журнал, ваши колода и сброс. */
  OPP_PILES: { x: 20, y: 18, w: 252, h: 84 },
  LOG: { x: 20, y: 114, w: 252, h: 678 },
  SELF_PILES: { x: 20, y: 804, w: 252, h: 258 },
  /** Средняя колонка: рука соперника сверху, ваша рука снизу; между ними поля и торговый ряд (см. fieldRects). */
  OPP_HAND: { x: 290, y: 18, w: 1336, h: 84 },
  SELF_HAND: { x: 290, y: 804, w: 1336, h: 258 },
  /** Правая колонка: панель соперника (вдвое выше остальных верхних блоков: имя помещается целиком), ход и пулы, ваша панель. */
  OPP_PANEL: { x: 1644, y: 18, w: 256, h: 168 },
  TURN: { x: 1644, y: 198, w: 256, h: 594 },
  SELF_PANEL: { x: 1644, y: 804, w: 256, h: 258 },
} as const satisfies Record<string, Rect>

const MIDDLE_X = 290
const MIDDLE_W = 1336
const MIDDLE_TOP = 114
const MIDDLE_H = 678
const ROW_GAP = 12
const FULL_FIELD_H = 196
const COMPACT_FIELD_H = 104

/**
 * Три средних блока (поле соперника, торговый ряд, ваше поле) делят одну и ту же высоту. Поле того, чей сейчас
 * ход, остаётся полным (базы и корабли), поле ждущего сжимается вдвое до одних баз, а освободившееся место
 * достаётся торговому ряду.
 */
export function fieldRects(selfActive: boolean): { opponentField: Rect, trade: Rect, selfField: Rect } {
  const opponentH = selfActive ? COMPACT_FIELD_H : FULL_FIELD_H
  const selfH = selfActive ? FULL_FIELD_H : COMPACT_FIELD_H
  const tradeH = MIDDLE_H - opponentH - selfH - ROW_GAP * 2
  const tradeY = MIDDLE_TOP + opponentH + ROW_GAP
  return {
    opponentField: { x: MIDDLE_X, y: MIDDLE_TOP, w: MIDDLE_W, h: opponentH },
    trade: { x: MIDDLE_X, y: tradeY, w: MIDDLE_W, h: tradeH },
    selfField: { x: MIDDLE_X, y: tradeY + tradeH + ROW_GAP, w: MIDDLE_W, h: selfH },
  }
}

export function rectStyle(rect: Rect): Record<string, string> {
  return { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` }
}
