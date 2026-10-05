import type { Rect } from '../../../lib/rects'
import type { TableState } from '../../table'
import { fieldRects, RECT } from '../../../lib/rects'

/*
 * Геометрия стола в логических пикселях сцены 1920x1080. Колонки 252 / 1336 / 256 с зазором 18 и отступами 20
 * (числа из дизайна); высота полей и торгового ряда зависит от того, чей ход (см. fieldRects).
 * Все позиции карт считаются здесь, а не измеряются из DOM: сцена масштабируется целиком, поэтому координаты
 * не зависят от размера окна и GSAP может анимировать карты между зонами без пересчёта.
 */

/** Положение и вид карты на сцене. x, y - центр карты; scale применяется к натуральному размеру (200x280). */
export interface Pose {
  x: number
  y: number
  rot: number
  scale: number
  z: number
  opacity: number
}

export const SCALE = {
  HAND: 0.92,
  TRADE: 0.9,
  FIELD: 0.66,
  /** Поле того, кто сейчас не ходит: базы уменьшены вдвое-втрое, читать их помогает крупный просмотр. */
  FIELD_COMPACT: 0.46,
  PILE: 0.55,
  TRADE_DECK: 0.5,
  OPP_HAND: 0.55,
  OPP_PILE: 0.26,
  SCRAPPED: 0.3,
} as const

const CARD_W = 200
const CARD_H = 280
const DEPLOYED_W = 280

const centerX = (rect: Rect): number => rect.x + rect.w / 2

function pose(x: number, y: number, scale: number, extra: Partial<Pose> = {}): Pose {
  return { x, y, rot: 0, scale, z: 1, opacity: 1, ...extra }
}

/* ---------- Рука ---------- */

const HAND_PITCH = 168

/**
 * Веер карт в руке: каждая следующая чуть ниже и повёрнута вокруг нижней середины карты, как в дизайне.
 * lifted - индекс карты под курсором: она выпрямляется и приподнимается.
 */
export function handPoses(count: number, lifted: number | null = null): Pose[] {
  const mid = (count - 1) / 2
  const pitch = count > 7 ? Math.min(HAND_PITCH, 1180 / (count - 1)) : HAND_PITCH
  const height = CARD_H * SCALE.HAND
  const poses: Pose[] = []
  for (let i = 0; i < count; i++) {
    const d = i - mid
    const isLifted = i === lifted
    const offsetY = isLifted ? -18 : 26 + d * d * 4
    const rot = isLifted ? 0 : d * 3.5
    const rad = (rot * Math.PI) / 180
    const pivotX = centerX(RECT.SELF_HAND) + d * pitch
    const pivotY = RECT.SELF_HAND.y + offsetY + height
    // Поворот идёт вокруг нижней середины карты, а позиция хранится по центру: смещаем центр по дуге.
    poses.push({
      x: pivotX + (height / 2) * Math.sin(rad),
      y: pivotY - (height / 2) * Math.cos(rad),
      rot,
      scale: SCALE.HAND,
      z: isLifted ? 50 : i + 1,
      opacity: 1,
    })
  }
  return poses
}

/** Рука соперника: рубашки веером, торчат из-за верхней границы экрана; все вращаются вокруг точки над ними. */
export function opponentHandPoses(count: number): Pose[] {
  const mid = (count - 1) / 2
  const radius = 437
  const pivotX = centerX(RECT.OPP_HAND)
  const pivotY = -428
  const poses: Pose[] = []
  for (let i = 0; i < count; i++) {
    const angle = ((i - mid) * 6 * Math.PI) / 180
    poses.push({
      x: pivotX + radius * Math.sin(angle),
      y: pivotY + radius * Math.cos(angle),
      rot: -(i - mid) * 6,
      scale: SCALE.OPP_HAND,
      z: i + 1,
      opacity: 1,
    })
  }
  return poses
}

/* ---------- Поля: базы и корабли ---------- */

/** Прямоугольник поля и режим: у ждущего игрока поле «сжато» и содержит только базы. */
export interface FieldFrame {
  rect: Rect
  compact: boolean
}

export interface FieldGeometry {
  basesX: number
  basesW: number
  /** У сжатого поля зоны кораблей нет: следующие значения тогда равны null. */
  dividerX: number | null
  shipsLabelX: number | null
  shipsX: number | null
  shipsW: number | null
}

/** Ряд карт слева направо; если не помещаются, шаг уменьшается и карты перекрывают друг друга. */
function row(count: number, zoneX: number, zoneW: number, itemW: number, gap: number, y: number, scale: number): Pose[] {
  const pitch = count > 1 ? Math.min(itemW + gap, (zoneW - itemW) / (count - 1)) : 0
  const poses: Pose[] = []
  for (let i = 0; i < count; i++)
    poses.push(pose(zoneX + itemW / 2 + i * pitch, y, scale, { z: i + 1 }))
  return poses
}

const FIELD_PADDING = 12
const FULL_BASE_W = DEPLOYED_W * SCALE.FIELD
const COMPACT_BASE_W = DEPLOYED_W * SCALE.FIELD_COMPACT
const BASE_GAP = 18
const COMPACT_GAP = 14
const MIN_BASES_W = 420
const MAX_BASES_W = 640
const MIN_SHIPS_W = 480
/** От правого края зоны баз до первого корабля: разделитель, подпись «КОРАБЛИ» и отступы. */
const SHIPS_OFFSET = 66

/**
 * Полное поле делится на зону баз слева и зону кораблей справа. Зона баз растёт вместе с числом баз (но не
 * бесконечно), разделитель и подпись «КОРАБЛИ» едут за ней. Сжатое поле - только базы, на всю ширину.
 */
export function fieldGeometry(frame: FieldFrame, baseCount: number): FieldGeometry {
  const basesX = frame.rect.x + FIELD_PADDING + 29
  const right = frame.rect.x + frame.rect.w - 20
  if (frame.compact)
    return { basesX, basesW: right - basesX, dividerX: null, shipsLabelX: null, shipsX: null, shipsW: null }

  const wanted = baseCount * FULL_BASE_W + Math.max(0, baseCount - 1) * BASE_GAP
  const basesW = Math.min(MAX_BASES_W, Math.max(MIN_BASES_W, wanted))
  const shipsX = basesX + basesW + SHIPS_OFFSET
  return {
    basesX,
    basesW,
    dividerX: basesX + basesW + 18,
    shipsLabelX: basesX + basesW + 37,
    shipsX,
    shipsW: Math.max(MIN_SHIPS_W, right - shipsX),
  }
}

const fieldCenterY = (frame: FieldFrame): number => frame.rect.y + frame.rect.h / 2

export function shipPoses(frame: FieldFrame, count: number, baseCount: number): Pose[] {
  const zone = fieldGeometry(frame, baseCount)
  // Корабли в сжатом поле не бывают: они уходят в сброс до смены хода. Если всё же попали - просто за базами.
  const x = zone.shipsX ?? zone.basesX + zone.basesW
  const width = zone.shipsW ?? MIN_SHIPS_W
  return row(count, x, width, CARD_W * SCALE.FIELD, 12, fieldCenterY(frame), SCALE.FIELD)
}

export function basePoses(frame: FieldFrame, count: number): Pose[] {
  const zone = fieldGeometry(frame, count)
  const compact = frame.compact
  return row(
    count,
    zone.basesX,
    zone.basesW,
    compact ? COMPACT_BASE_W : FULL_BASE_W,
    compact ? COMPACT_GAP : BASE_GAP,
    fieldCenterY(frame),
    compact ? SCALE.FIELD_COMPACT : SCALE.FIELD,
  )
}

/* ---------- Торговый ряд ---------- */

/**
 * Блок «пачка исследователей - ряд из 5 - колода рынка» занимает всю ширину средней колонки. Размеры
 * подобраны под ширину 1336: пачка и пять слотов по 180 пикселей с шагом 188, справа колода рынка.
 */
const TRADE_CARD_W = CARD_W * SCALE.TRADE
const TRADE_CARD_H = CARD_H * SCALE.TRADE
const TRADE_SLOT_PITCH = TRADE_CARD_W + 8
const CAPTION_GAP = 8
const CAPTION_H = 16

export interface TradeFrame {
  rect: Rect
  /** Центр карт ряда по вертикали. */
  cardY: number
  /** Центр подписей под картами («КУПИТЬ»). */
  captionY: number
  explorersX: number
  firstSlotX: number
  dividerLeftX: number
  dividerRightX: number
  dividerTop: number
  dividerH: number
  labelX: number
  deck: { x: number, y: number }
  scrap: { x: number, y: number, w: number, h: number }
}

function tradeFrame(rect: Rect): TradeFrame {
  const blockH = TRADE_CARD_H + CAPTION_GAP + CAPTION_H
  const top = rect.y + (rect.h - blockH) / 2
  const centerY = rect.y + rect.h / 2
  return {
    rect,
    cardY: top + TRADE_CARD_H / 2,
    captionY: top + TRADE_CARD_H + CAPTION_GAP + CAPTION_H / 2,
    explorersX: 404,
    firstSlotX: 621,
    dividerLeftX: 506,
    dividerRightX: 1487,
    dividerTop: top,
    dividerH: blockH,
    labelX: 296,
    deck: { x: 1562, y: centerY - 40 },
    scrap: { x: 1562, y: centerY + 100, w: 120, h: 34 },
  }
}

export function explorersPose(trade: TradeFrame): Pose {
  return pose(trade.explorersX, trade.cardY, SCALE.TRADE, { z: 5 })
}

export function tradeSlotPose(trade: TradeFrame, slot: number): Pose {
  return pose(trade.firstSlotX + slot * TRADE_SLOT_PITCH, trade.cardY, SCALE.TRADE, { z: 5 })
}

export function tradeSlotX(trade: TradeFrame, slot: number): number {
  return trade.firstSlotX + slot * TRADE_SLOT_PITCH
}

export function tradeDeckPose(trade: TradeFrame): Pose {
  return pose(trade.deck.x, trade.deck.y, SCALE.TRADE_DECK, { z: 2 })
}

/** Куда улетают утилизированные карты: на кнопку свалки, уменьшаясь и растворяясь. */
export function scrapHeapPose(trade: TradeFrame): Pose {
  return pose(trade.scrap.x, trade.scrap.y, SCALE.SCRAPPED, { z: 1, opacity: 0 })
}

export const TRADE_SLOT_W = TRADE_CARD_W

/* ---------- Раскладка стола целиком ---------- */

export interface BoardLayout {
  opponentField: FieldFrame
  selfField: FieldFrame
  trade: TradeFrame
}

function buildLayout(selfActive: boolean): BoardLayout {
  const rects = fieldRects(selfActive)
  return {
    opponentField: { rect: rects.opponentField, compact: selfActive },
    selfField: { rect: rects.selfField, compact: !selfActive },
    trade: tradeFrame(rects.trade),
  }
}

const LAYOUTS = { active: buildLayout(true), waiting: buildLayout(false) } as const

/** Раскладка для хода игрока: в свой ход поле соперника сжато, в чужой - ваше. */
export function boardLayout(selfActive: boolean): BoardLayout {
  return selfActive ? LAYOUTS.active : LAYOUTS.waiting
}

export function layoutOf(table: Pick<TableState, 'you' | 'currentPlayer'>): BoardLayout {
  return boardLayout(table.currentPlayer === table.you)
}

/* ---------- Колоды и сбросы ---------- */

/** Левая колонка: ваши колода и сброс внизу, колода и сброс соперника вверху. */
export const PILE = {
  selfDeck: { x: 82, y: 955 },
  selfDiscard: { x: 210, y: 955 },
  opponentDeck: { x: 70, y: 60 },
  opponentDiscard: { x: 180, y: 60 },
} as const

export function selfDeckPose(): Pose {
  return pose(PILE.selfDeck.x, PILE.selfDeck.y, SCALE.PILE, { z: 2 })
}

export function selfDiscardPose(depth = 0): Pose {
  return pose(PILE.selfDiscard.x, PILE.selfDiscard.y, SCALE.PILE, { z: 3 + depth })
}

export function opponentDeckPose(): Pose {
  return pose(PILE.opponentDeck.x, PILE.opponentDeck.y, SCALE.OPP_PILE, { z: 2 })
}

export function opponentDiscardPose(depth = 0): Pose {
  return pose(PILE.opponentDiscard.x, PILE.opponentDiscard.y, SCALE.OPP_PILE, { z: 3 + depth })
}

/** Точка, из которой «выходит» карта соперника, когда он её разыгрывает: середина веера. */
export function opponentHandOrigin(): Pose {
  return opponentHandPoses(1)[0]!
}

/* ---------- Перетаскивание ---------- */

/** Куда можно отпустить перетаскиваемую карту. */
export const DROP_ZONE = {
  /** Весь стол выше руки: сюда бросают карту руки, чтобы сыграть её. */
  TABLE: 'table',
  /** Нижняя полоса сцены (рука, колода, сброс, панель авторитета): сюда бросают карту рынка, чтобы купить её. */
  OWN_SIDE: 'own-side',
} as const
export type DropZone = (typeof DROP_ZONE)[keyof typeof DROP_ZONE]

/** Отступ от руки: карту нужно потянуть заметно вверх, а не просто чуть сдвинуть. */
const TABLE_DROP_MARGIN = 24

/** Прямоугольники зоны броска (сейчас у каждой зоны один). */
export function dropRects(zone: DropZone): Rect[] {
  if (zone === DROP_ZONE.TABLE)
    return [{ x: 0, y: 0, w: 1920, h: RECT.SELF_HAND.y - TABLE_DROP_MARGIN }]
  return [{ x: 0, y: RECT.SELF_HAND.y, w: 1920, h: 1080 - RECT.SELF_HAND.y }]
}

export function insideRect(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
}

export function insideAny(rects: readonly Rect[], x: number, y: number): boolean {
  return rects.some(rect => insideRect(rect, x, y))
}

/* ---------- Крупный просмотр карты ---------- */

export const PREVIEW_SCALE = 1.25
const PREVIEW_GAP = 14
const PREVIEW_MARGIN = 8

/**
 * Где показать увеличенную копию карты под курсором: над ней, по центру; если сверху нет места - под ней.
 * Центр просмотра не выходит за края сцены.
 */
export function previewPlacement(node: Pose, naturalH: number, stage: { w: number, h: number }): { x: number, y: number } {
  const half = (naturalH * node.scale) / 2
  const w = CARD_W * PREVIEW_SCALE
  const h = CARD_H * PREVIEW_SCALE
  const above = node.y - half - PREVIEW_GAP - h / 2
  const below = node.y + half + PREVIEW_GAP + h / 2
  const y = above - h / 2 >= PREVIEW_MARGIN ? above : below
  return {
    x: Math.min(Math.max(node.x, w / 2 + PREVIEW_MARGIN), stage.w - w / 2 - PREVIEW_MARGIN),
    y: Math.min(y, stage.h - h / 2 - PREVIEW_MARGIN),
  }
}
