import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { PingSchema, PongSchema } from './heartbeat.ts'

describe('heartbeat', () => {
  it('принимает только ping и pong', () => {
    expect(v.is(PingSchema, 'ping')).toBe(true)
    expect(v.is(PingSchema, 'pong')).toBe(false)
    expect(v.is(PongSchema, 'pong')).toBe(true)
  })
})
