import { describe, expect, it } from 'vitest'
import { createRng } from './rng.ts'

describe('createRng', () => {
  it('выдаёт одну и ту же последовательность для одного сида', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()))
  })

  it('выдаёт разные последовательности для разных сидов', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next())
  })

  it('shuffle сохраняет состав, не мутирует исходный массив и детерминирован', () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8]
    const shuffled = createRng(7).shuffle(source)
    expect(source).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...shuffled].sort((x, y) => x - y)).toEqual(source)
    expect(createRng(7).shuffle(source)).toEqual(shuffled)
  })
})
