import { describe, expect, it } from 'vitest'
import { clampToViewport } from './clamp-to-viewport'

const element = { width: 350, height: 100 }
const viewport = { width: 1000, height: 600 }

describe('clampToViewport', () => {
  it('оставляет положение внутри окна как есть', () => {
    expect(clampToViewport({ x: 20, y: 30 }, element, viewport)).toEqual({ x: 20, y: 30 })
  })

  it('не даёт выйти за левый и верхний край', () => {
    expect(clampToViewport({ x: -40, y: -5 }, element, viewport)).toEqual({ x: 0, y: 0 })
  })

  it('не даёт выйти за правый и нижний край с учётом размера элемента', () => {
    expect(clampToViewport({ x: 900, y: 590 }, element, viewport)).toEqual({ x: 650, y: 500 })
  })

  it('прижимает к левому верхнему углу, если окно меньше элемента', () => {
    expect(clampToViewport({ x: 50, y: 50 }, element, { width: 300, height: 80 })).toEqual({ x: 0, y: 0 })
  })
})
