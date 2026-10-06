import { afterEach, describe, expect, it, vi } from 'vitest'
import { randomId } from './random-id'

describe('randomId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('в защищённом контексте берёт crypto.randomUUID', () => {
    expect(randomId()).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('без randomUUID (обычный http) собирает id из getRandomValues, и он не повторяется', () => {
    // В незащищённом контексте браузер даёт crypto без randomUUID, но с getRandomValues.
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) })
    const ids = new Set(Array.from({ length: 200 }, () => randomId()))
    expect(ids.size).toBe(200)
    for (const id of ids)
      expect(id).toMatch(/^[0-9a-f]{32}$/)
  })
})
