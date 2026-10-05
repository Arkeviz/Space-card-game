import type { Box } from './roving'
import { describe, expect, it } from 'vitest'
import { rovingTarget } from './roving'

/** Сетка 3 колонки x 2 ряда: индексы 0 1 2 / 3 4 5, ячейка 100x140. */
const grid: Box[] = Array.from({ length: 6 }, (_, index) => ({
  left: (index % 3) * 120,
  top: Math.floor(index / 3) * 160,
  width: 100,
  height: 140,
}))

describe('rovingTarget', () => {
  it('влево и вправо идут по порядку и упираются в края', () => {
    expect(rovingTarget(grid, 1, 'ArrowRight')).toBe(2)
    expect(rovingTarget(grid, 1, 'ArrowLeft')).toBe(0)
    expect(rovingTarget(grid, 0, 'ArrowLeft')).toBeNull()
    expect(rovingTarget(grid, 5, 'ArrowRight')).toBeNull()
  })

  it('home и End - первый и последний', () => {
    expect(rovingTarget(grid, 4, 'Home')).toBe(0)
    expect(rovingTarget(grid, 1, 'End')).toBe(5)
  })

  it('вверх и вниз - тот же столбец соседнего ряда, у края - некуда', () => {
    expect(rovingTarget(grid, 1, 'ArrowDown')).toBe(4)
    expect(rovingTarget(grid, 5, 'ArrowUp')).toBe(2)
    expect(rovingTarget(grid, 4, 'ArrowDown')).toBeNull()
    expect(rovingTarget(grid, 0, 'ArrowUp')).toBeNull()
  })

  it('в неполном нижнем ряду выбирается ближайший по горизонтали', () => {
    // Пять элементов: 0 1 2 / 3 4. Из правого верхнего вниз - правый нижний (4).
    expect(rovingTarget(grid.slice(0, 5), 2, 'ArrowDown')).toBe(4)
  })

  it('один ряд: вверх и вниз идти некуда; пустой список и неверный индекс - null', () => {
    const row = grid.slice(0, 3)
    expect(rovingTarget(row, 1, 'ArrowDown')).toBeNull()
    expect(rovingTarget([], 0, 'ArrowRight')).toBeNull()
    expect(rovingTarget(grid, 9, 'Home')).toBeNull()
  })
})
