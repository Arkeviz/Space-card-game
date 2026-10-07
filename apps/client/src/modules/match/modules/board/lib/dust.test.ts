import { describe, expect, it } from 'vitest'
import { dustColor, parseCssColor, pickColor } from './dust'

describe('parseCssColor', () => {
  it('разбирает rgb и rgba в обеих записях', () => {
    expect(parseCssColor('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30, a: 1 })
    expect(parseCssColor('rgba(10, 20, 30, 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 })
    expect(parseCssColor('rgb(10 20 30 / 40%)')).toEqual({ r: 10, g: 20, b: 30, a: 0.4 })
  })

  it('прозрачный и незнакомые записи - null', () => {
    expect(parseCssColor('transparent')).toBeNull()
    expect(parseCssColor('linear-gradient(red, blue)')).toBeNull()
    expect(parseCssColor('')).toBeNull()
  })
})

describe('dustColor', () => {
  const channels = (css: string): number[] => (/\d+/.exec(css) === null ? [] : css.match(/\d+/g)!.map(Number))
  const luminance = ([r, g, b]: number[]): number => 0.2126 * r! + 0.7152 * g! + 0.0722 * b!

  it('тёмный цвет становится заметно светлее', () => {
    const dark = channels(dustColor({ r: 8, g: 12, b: 30, a: 1 }))
    expect(luminance(dark)).toBeGreaterThan(luminance([8, 12, 30]) + 60)
  })

  it('светлый цвет почти не меняется, но не темнеет', () => {
    const light = channels(dustColor({ r: 240, g: 240, b: 250, a: 1 }))
    expect(luminance(light)).toBeGreaterThan(200)
  })

  it('оттенок сохраняется: синий остаётся синее красного', () => {
    const [r, , b] = channels(dustColor({ r: 20, g: 40, b: 200, a: 1 }))
    expect(b).toBeGreaterThan(r!)
  })
})

describe('pickColor', () => {
  const palette = [
    { color: 'a', weight: 1 },
    { color: 'b', weight: 3 },
  ]

  it('выбор пропорционален весам', () => {
    expect(pickColor(palette, 0)).toBe('a')
    expect(pickColor(palette, 0.24)).toBe('a')
    expect(pickColor(palette, 0.26)).toBe('b')
    expect(pickColor(palette, 0.999)).toBe('b')
  })
})
