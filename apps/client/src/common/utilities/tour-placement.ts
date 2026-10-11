/** Прямоугольник в координатах сцены (логические пиксели). */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export const TOUR_SIDE = {
  TOP: 'top',
  BOTTOM: 'bottom',
  LEFT: 'left',
  RIGHT: 'right',
} as const
export type TourSide = (typeof TOUR_SIDE)[keyof typeof TOUR_SIDE]

export interface PlaceInput {
  /** Элемент, к которому крепится окно; null - окно по центру области. */
  target: Box | null
  /** Размер окна. */
  size: { w: number, h: number }
  /** Область, внутри которой окно должно остаться. */
  bounds: { w: number, h: number }
  /** Предпочтительная сторона от цели. */
  side: TourSide
  /** Расстояние от цели до окна (там помещается стрелка). */
  gap: number
  /** Минимальный отступ окна от края области. */
  margin: number
  /** Отступ стрелки от угла окна: она не должна упираться в скругление. */
  arrowInset: number
}

export interface Placed {
  x: number
  y: number
  /** Сторона цели, с которой оказалось окно; 'center' - цели нет или окно нигде не помещается рядом с ней. */
  side: TourSide | 'center'
  /** Смещение центра стрелки вдоль кромки окна, обращённой к цели; null, когда стрелки нет. */
  arrow: number | null
}

const OPPOSITE: Record<TourSide, TourSide> = {
  [TOUR_SIDE.TOP]: TOUR_SIDE.BOTTOM,
  [TOUR_SIDE.BOTTOM]: TOUR_SIDE.TOP,
  [TOUR_SIDE.LEFT]: TOUR_SIDE.RIGHT,
  [TOUR_SIDE.RIGHT]: TOUR_SIDE.LEFT,
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), Math.max(min, max))

/** Порядок попыток: заданная сторона, противоположная, затем две оставшиеся. */
function sidesToTry(side: TourSide): TourSide[] {
  const rest = Object.values(TOUR_SIDE).filter(item => item !== side && item !== OPPOSITE[side])
  return [side, OPPOSITE[side], ...rest]
}

function attach(input: PlaceInput, target: Box, side: TourSide): { x: number, y: number, fits: boolean } {
  const { size, bounds, gap, margin } = input
  const horizontal = side === TOUR_SIDE.LEFT || side === TOUR_SIDE.RIGHT
  let x: number
  let y: number
  if (horizontal) {
    x = side === TOUR_SIDE.LEFT ? target.x - gap - size.w : target.x + target.w + gap
    y = target.y + target.h / 2 - size.h / 2
  }
  else {
    x = target.x + target.w / 2 - size.w / 2
    y = side === TOUR_SIDE.TOP ? target.y - gap - size.h : target.y + target.h + gap
  }
  // Вдоль главной оси окно должно целиком поместиться, поперёк - его можно сдвинуть, чтобы не вылезало за край.
  const fits = horizontal
    ? x >= margin && x + size.w <= bounds.w - margin
    : y >= margin && y + size.h <= bounds.h - margin
  return {
    x: horizontal ? x : clamp(x, margin, bounds.w - size.w - margin),
    y: horizontal ? clamp(y, margin, bounds.h - size.h - margin) : y,
    fits,
  }
}

/**
 * Где показать окно подсказки. Берётся первая сторона, с которой оно помещается рядом с целью (по порядку:
 * заданная, противоположная, остальные); поперёк кромки цели окно центрируется и сдвигается в границы области.
 * Если не помещается ни с одной стороны (цель занимает почти всю область), окно встаёт по центру без стрелки.
 */
export function placeTour(input: PlaceInput): Placed {
  const { target, size, bounds, arrowInset } = input
  const center: Placed = {
    x: Math.round((bounds.w - size.w) / 2),
    y: Math.round((bounds.h - size.h) / 2),
    side: 'center',
    arrow: null,
  }
  if (!target)
    return center

  for (const side of sidesToTry(input.side)) {
    const spot = attach(input, target, side)
    if (!spot.fits)
      continue
    const horizontal = side === TOUR_SIDE.LEFT || side === TOUR_SIDE.RIGHT
    const along = horizontal ? target.y + target.h / 2 - spot.y : target.x + target.w / 2 - spot.x
    const span = horizontal ? size.h : size.w
    return {
      x: Math.round(spot.x),
      y: Math.round(spot.y),
      side,
      arrow: Math.round(clamp(along, arrowInset, span - arrowInset)),
    }
  }
  return center
}
