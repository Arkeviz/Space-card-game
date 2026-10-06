import { describe, expect, it } from 'vitest'
import { clientKey, TokenBucket } from './limits.ts'

describe('tokenBucket', () => {
  it('пропускает всплеск до ёмкости, потом отказывает', () => {
    const bucket = new TokenBucket(3, 1 / 1000, 0)
    expect([bucket.take(0), bucket.take(0), bucket.take(0), bucket.take(0)]).toEqual([true, true, true, false])
  })

  it('пополняется со временем, но не сверх ёмкости', () => {
    const bucket = new TokenBucket(2, 1 / 1000, 0)
    bucket.take(0)
    bucket.take(0)
    expect(bucket.take(500)).toBe(false)
    expect(bucket.take(1000)).toBe(true)
    expect(bucket.isFull(1_000_000)).toBe(true)
    expect([bucket.take(1_000_000), bucket.take(1_000_000), bucket.take(1_000_000)]).toEqual([true, true, false])
  })

  it('часы, ушедшие назад, не отнимают токены', () => {
    const bucket = new TokenBucket(1, 1 / 1000, 10_000)
    expect(bucket.take(5_000)).toBe(true)
    expect(bucket.take(6_000)).toBe(true)
  })
})

describe('clientKey', () => {
  it('iPv4 - как есть, IPv4 внутри IPv6 - как IPv4', () => {
    expect(clientKey('203.0.113.5')).toBe('203.0.113.5')
    expect(clientKey('::ffff:203.0.113.5')).toBe('203.0.113.5')
  })

  it('iPv6 сводится к сети /64 в одной записи независимо от формы', () => {
    const key = clientKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd')
    expect(key).toBe('2001:db8:1:2::/64')
    expect(clientKey('2001:0db8:0001:0002::1')).toBe(key)
    expect(clientKey('2001:DB8:1:2::5%eth0')).toBe(key)
    expect(clientKey('2001:db8:1:3::1')).not.toBe(key)
    expect(clientKey('::1')).toBe('0:0:0:0::/64')
  })

  it('неизвестный адрес - общий ключ', () => {
    expect(clientKey(undefined)).toBe('unknown')
    expect(clientKey('')).toBe('unknown')
  })
})
