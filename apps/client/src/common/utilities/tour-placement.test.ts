import type { PlaceInput } from './tour-placement'
import { describe, expect, it } from 'vitest'
import { placeTour, TOUR_SIDE } from './tour-placement'

const base: PlaceInput = {
  target: { x: 800, y: 500, w: 200, h: 100 },
  size: { w: 400, h: 200 },
  bounds: { w: 1920, h: 1080 },
  side: TOUR_SIDE.TOP,
  gap: 16,
  margin: 12,
  arrowInset: 24,
}

describe('placeTour', () => {
  it('ставит окно над целью по её центру, стрелка смотрит в центр цели', () => {
    const placed = placeTour(base)
    expect(placed).toEqual({ x: 700, y: 284, side: 'top', arrow: 200 })
  })

  it('без цели выставляет окно по центру области и без стрелки', () => {
    expect(placeTour({ ...base, target: null })).toEqual({ x: 760, y: 440, side: 'center', arrow: null })
  })

  it('переворачивает окно на противоположную сторону, если сверху нет места', () => {
    const placed = placeTour({ ...base, target: { x: 800, y: 100, w: 200, h: 100 } })
    expect(placed.side).toBe('bottom')
    expect(placed.y).toBe(216)
  })

  it('сдвигает окно вдоль кромки, чтобы не вылезать за край, а стрелку оставляет на цели', () => {
    const placed = placeTour({ ...base, target: { x: 0, y: 500, w: 100, h: 100 } })
    expect(placed.side).toBe('top')
    expect(placed.x).toBe(12)
    expect(placed.arrow).toBe(Math.round(50 - 12))
  })

  it('не отпускает стрелку ближе arrowInset к углу окна', () => {
    const placed = placeTour({ ...base, target: { x: 0, y: 500, w: 10, h: 100 } })
    expect(placed.arrow).toBe(24)
  })

  it('ставит окно слева от цели у правого края сцены', () => {
    const placed = placeTour({ ...base, side: TOUR_SIDE.LEFT, target: { x: 1644, y: 300, w: 256, h: 168 } })
    expect(placed.side).toBe('left')
    expect(placed.x).toBe(1644 - 16 - 400)
    expect(placed.y).toBe(300 + 84 - 100)
    expect(placed.arrow).toBe(100)
  })

  it('уходит на другую сторону, если нужной не хватает, но слева место есть', () => {
    const placed = placeTour({ ...base, side: TOUR_SIDE.RIGHT, target: { x: 1644, y: 300, w: 256, h: 168 } })
    expect(placed.side).toBe('left')
  })

  it('центрирует окно, если цель занимает всю область', () => {
    const placed = placeTour({ ...base, target: { x: 0, y: 0, w: 1920, h: 1080 } })
    expect(placed.side).toBe('center')
    expect(placed.arrow).toBeNull()
  })
})
