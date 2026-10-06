import { describe, expect, it } from 'vitest'
import { ANIMATION_MODE, cleanPlayerName, DEFAULT_SETTINGS, motionFactor, parseSettings, REDUCED_MOTION_FACTOR } from './settings'

describe('parseSettings', () => {
  it('не объект или пустой объект - настройки по умолчанию', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('строка')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings(42)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings({})).toEqual(DEFAULT_SETTINGS)
  })

  it('корректные значения сохраняются', () => {
    const custom = { playerName: 'Алиса', animationSpeed: 1.5, animationMode: ANIMATION_MODE.REDUCED, endTurnWarning: false, hotkeys: false, dragAndDrop: false }
    expect(parseSettings(custom)).toEqual(custom)
  })

  it('каждое испорченное поле заменяется по отдельности, остальные остаются', () => {
    const parsed = parseSettings({ playerName: 7, animationSpeed: 3, animationMode: 'turbo', endTurnWarning: 'да', hotkeys: false, dragAndDrop: null })
    expect(parsed).toEqual({ ...DEFAULT_SETTINGS, hotkeys: false })
  })

  it('лишние поля отбрасываются', () => {
    expect(parseSettings({ ...DEFAULT_SETTINGS, secret: 'x' })).toEqual(DEFAULT_SETTINGS)
  })

  it('имя очищается при чтении', () => {
    expect(parseSettings({ playerName: '  Алиса\n' }).playerName).toBe('Алиса')
  })
})

describe('cleanPlayerName', () => {
  it('убирает управляющие и невидимые символы и пробелы по краям', () => {
    expect(cleanPlayerName('  Али\u0000​са ')).toBe('Алиса')
  })

  it('обрезает по пределу протокола, не разрывая символы вне BMP', () => {
    const long = '🚀'.repeat(30)
    expect([...cleanPlayerName(long)]).toHaveLength(20)
  })
})

describe('motionFactor', () => {
  it('режим «как в системе» следует prefers-reduced-motion', () => {
    const settings = { animationSpeed: 1, animationMode: ANIMATION_MODE.SYSTEM }
    expect(motionFactor(settings, false)).toBe(1)
    expect(motionFactor(settings, true)).toBe(REDUCED_MOTION_FACTOR)
  })

  it('полные анимации игнорируют системную настройку, сокращённые включаются всегда', () => {
    expect(motionFactor({ animationSpeed: 1, animationMode: ANIMATION_MODE.FULL }, true)).toBe(1)
    expect(motionFactor({ animationSpeed: 1, animationMode: ANIMATION_MODE.REDUCED }, false)).toBe(REDUCED_MOTION_FACTOR)
  })

  it('скорость умножается на коэффициент', () => {
    expect(motionFactor({ animationSpeed: 2, animationMode: ANIMATION_MODE.FULL }, false)).toBe(2)
    expect(motionFactor({ animationSpeed: 0.75, animationMode: ANIMATION_MODE.REDUCED }, false)).toBe(0.75 * REDUCED_MOTION_FACTOR)
  })
})
