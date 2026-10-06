import { END_REASON } from '@space/protocol'
import { describe, expect, it } from 'vitest'
import { rematchView, resultReason } from './game-over'

describe('resultReason', () => {
  it('у каждой причины свой текст для победы и для поражения', () => {
    const reasons = Object.values(END_REASON)
    const texts = reasons.flatMap(reason => [resultReason(true, reason), resultReason(false, reason)])
    expect(new Set(texts).size).toBe(reasons.length * 2)
  })

  it('отключение и бездействие объясняются отдельно от сдачи', () => {
    expect(resultReason(true, END_REASON.DISCONNECT)).toContain('не вернулся')
    expect(resultReason(false, END_REASON.IDLE)).toContain('не делали ходов')
    expect(resultReason(true, END_REASON.CONCEDE)).toBe('Соперник сдался.')
    expect(resultReason(false, END_REASON.CONCEDE)).toBe('Вы сдались.')
  })

  it('без причины - нейтральный текст', () => {
    expect(resultReason(true, null)).toBe('Партия окончена.')
  })
})

describe('rematchView', () => {
  it('по умолчанию реванш можно предложить', () => {
    expect(rematchView({ you: false, opponent: false, available: true })).toEqual({ label: 'Реванш', disabled: false, note: null })
  })

  it('своё предложение ждёт ответа', () => {
    expect(rematchView({ you: true, opponent: false, available: true })).toMatchObject({ label: 'Ждём соперника…', disabled: true })
  })

  it('предложение соперника можно принять', () => {
    expect(rematchView({ you: false, opponent: true, available: true })).toEqual({ label: 'Принять реванш', disabled: false, note: 'Соперник предлагает реванш.' })
  })

  it('после ухода соперника реванш недоступен, даже если он до этого предлагал', () => {
    expect(rematchView({ you: false, opponent: true, available: false })).toEqual({ label: 'Реванш', disabled: true, note: 'Соперник покинул матч.' })
  })

  it('когда согласны оба, кнопка занята: партия вот-вот начнётся', () => {
    expect(rematchView({ you: true, opponent: true, available: true })).toMatchObject({ label: 'Начинаем…', disabled: true })
  })
})
