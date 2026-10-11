import { describe, expect, it } from 'vitest'
import { countdown } from './countdown'

describe('countdown', () => {
  const total = 5 * 60_000

  it('в начале осталось всё время', () => {
    expect(countdown(1000, 1000, total)).toEqual({ remainingMs: total, progress: 1, expired: false })
  })

  it('на середине осталась половина', () => {
    expect(countdown(0, total / 2, total)).toEqual({ remainingMs: total / 2, progress: 0.5, expired: false })
  })

  it('по истечении времени - ноль, дальше не уходит в минус', () => {
    expect(countdown(0, total, total)).toEqual({ remainingMs: 0, progress: 0, expired: true })
    expect(countdown(0, total * 2, total).remainingMs).toBe(0)
  })

  it('часы, ушедшие назад, не дают больше полного времени', () => {
    expect(countdown(1000, 0, total).remainingMs).toBe(total)
  })
})
