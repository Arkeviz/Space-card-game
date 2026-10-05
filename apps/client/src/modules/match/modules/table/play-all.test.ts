import { describe, expect, it } from 'vitest'
import { cardOpensPrompt, nextCardToPlay } from './play-all'

const hand = (...cardIds: string[]) => cardIds.map((cardId, index) => ({ id: `h${index}`, cardId }))

describe('cardOpensPrompt', () => {
  it('корабли с утилизацией или выбором открывают запрос, простые - нет', () => {
    expect(cardOpensPrompt('scout')).toBe(false)
    expect(cardOpensPrompt('cutter')).toBe(false)
    expect(cardOpensPrompt('trade-bot')).toBe(true)
    expect(cardOpensPrompt('battle-pod')).toBe(true)
  })

  it('сброс у соперника запроса не открывает: соперник сбросит карту в начале своего хода', () => {
    expect(cardOpensPrompt('imperial-fighter')).toBe(false)
  })

  it('базы запроса при розыгрыше не открывают: их способность активируется отдельно', () => {
    expect(cardOpensPrompt('barter-world')).toBe(false)
    expect(cardOpensPrompt('trading-post')).toBe(false)
  })
})

describe('nextCardToPlay', () => {
  it('сначала простые карты в порядке руки, карты с выбором - в конце', () => {
    const cards = hand('trade-bot', 'scout', 'battle-pod', 'viper')
    const playable = new Set(cards.map(card => card.id))
    expect(nextCardToPlay(cards, playable)).toBe('h1')
    expect(nextCardToPlay(cards.filter(card => card.id !== 'h1'), playable)).toBe('h3')
    expect(nextCardToPlay(cards.filter(card => card.cardId === 'trade-bot' || card.cardId === 'battle-pod'), playable)).toBe('h0')
  })

  it('играть нечего, если ни одна карта не разрешена', () => {
    expect(nextCardToPlay(hand('scout'), new Set())).toBeNull()
    expect(nextCardToPlay([], new Set(['h0']))).toBeNull()
  })
})
