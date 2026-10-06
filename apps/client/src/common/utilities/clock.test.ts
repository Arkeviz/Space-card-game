import { describe, expect, it } from 'vitest'
import { formatClock, formatElapsed } from './clock'

describe('formatClock', () => {
  it('округляет вверх и дополняет секунды нулём', () => {
    expect(formatClock(65_000)).toBe('1:05')
    expect(formatClock(64_001)).toBe('1:05')
    expect(formatClock(1)).toBe('0:01')
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(-500)).toBe('0:00')
    expect(formatClock(600_000)).toBe('10:00')
  })
})

describe('formatElapsed', () => {
  it('округляет вниз', () => {
    expect(formatElapsed(65_999)).toBe('1:05')
    expect(formatElapsed(999)).toBe('0:00')
    expect(formatElapsed(-1)).toBe('0:00')
  })
})
