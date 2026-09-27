import { describe, expect, it } from 'vitest'
import { HEARTBEAT, isPing } from './heartbeat.ts'

describe('heartbeat', () => {
  it('принимает только ping', () => {
    expect(isPing(HEARTBEAT.PING)).toBe(true)
    expect(isPing(HEARTBEAT.PONG)).toBe(false)
    expect(isPing(42)).toBe(false)
  })
})
