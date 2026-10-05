import { describe, expect, it } from 'vitest'
import { cardsWord, plural } from './plural'

describe('plural', () => {
  it('склоняет по последней цифре и исключениям 11-14', () => {
    const forms = ['карту', 'карты', 'карт'] as const
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111].map(count => plural(count, forms)))
      .toEqual(['карту', 'карты', 'карты', 'карт', 'карт', 'карт', 'карт', 'карту', 'карты', 'карт', 'карту', 'карт'])
  })

  it('cardsWord добавляет число', () => {
    expect(cardsWord(1)).toBe('1 карту')
    expect(cardsWord(3)).toBe('3 карты')
    expect(cardsWord(7)).toBe('7 карт')
  })
})
