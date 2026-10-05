import type { Prompt } from '@space/engine'
import { createGame, PROMPT_KIND, redact } from '@space/engine'
import { describe, expect, it } from 'vitest'
import { buildTable } from './build'
import { discardLimit } from './discard'

const base = buildTable(redact(createGame(5, { firstPlayer: 0 }), 0))
const withPrompt = (prompt: Prompt | null) => ({ ...base, prompt })

describe('discardLimit', () => {
  it('без запроса на сброс - одна карта', () => {
    expect(discardLimit(withPrompt(null))).toBe(1)
  })

  it('берёт remaining из запроса, но не больше карт в руке', () => {
    const hand = base.self.hand.length
    expect(discardLimit(withPrompt({ kind: PROMPT_KIND.DISCARD, id: 1, player: 0, source: null, remaining: 2 }))).toBe(Math.min(2, hand))
    expect(discardLimit(withPrompt({ kind: PROMPT_KIND.DISCARD, id: 1, player: 0, source: null, remaining: 99 }))).toBe(hand)
  })

  it('запрос соперника на ваш выбор не влияет', () => {
    expect(discardLimit(withPrompt({ kind: PROMPT_KIND.DISCARD, id: 1, player: 1, source: null, remaining: 2 }))).toBe(1)
  })
})
