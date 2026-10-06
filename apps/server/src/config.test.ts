import { describe, expect, it } from 'vitest'
import { DEFAULT_PORT, DEFAULT_RETENTION_DAYS, loadConfig } from './config.ts'
import { DEFAULT_LIMITS } from './limits.ts'

const DEFAULTS = {
  port: DEFAULT_PORT,
  databaseUrl: undefined,
  retentionDays: DEFAULT_RETENTION_DAYS,
  trustProxy: undefined,
  maxConnectionsPerIp: DEFAULT_LIMITS.maxConnectionsPerIp,
  matchStartsPerHour: DEFAULT_LIMITS.matchStartsPerHour,
}

describe('loadConfig', () => {
  it('без переменных - значения по умолчанию и работа без базы', () => {
    expect(loadConfig({})).toEqual(DEFAULTS)
  })

  it('читает порт, строку подключения и срок хранения', () => {
    expect(loadConfig({ PORT: '8080', DATABASE_URL: ' postgres://u:p@db/space ', MATCH_RETENTION_DAYS: '7' })).toEqual({
      ...DEFAULTS,
      port: 8080,
      databaseUrl: 'postgres://u:p@db/space',
      retentionDays: 7,
    })
  })

  it('читает доверенные прокси и лимиты по адресу, 0 выключает лимит', () => {
    expect(loadConfig({ TRUST_PROXY: ' uniquelocal,loopback ', MAX_CONNECTIONS_PER_IP: '0', MATCH_STARTS_PER_HOUR: '120' })).toEqual({
      ...DEFAULTS,
      trustProxy: 'uniquelocal,loopback',
      maxConnectionsPerIp: 0,
      matchStartsPerHour: 120,
    })
  })

  it('пустые значения считаются незаданными', () => {
    expect(loadConfig({ PORT: '', DATABASE_URL: '  ', MATCH_RETENTION_DAYS: '', TRUST_PROXY: ' ', MAX_CONNECTIONS_PER_IP: '', MATCH_STARTS_PER_HOUR: '' })).toEqual(DEFAULTS)
  })

  it('срок хранения может быть дробным, порт - только целым', () => {
    expect(loadConfig({ MATCH_RETENTION_DAYS: '0.5' }).retentionDays).toBe(0.5)
    expect(() => loadConfig({ PORT: '80.5' })).toThrow('PORT')
  })

  it('неверные значения останавливают запуск с понятным сообщением', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow('PORT')
    expect(() => loadConfig({ PORT: '0' })).toThrow('PORT')
    expect(() => loadConfig({ MATCH_RETENTION_DAYS: '-3' })).toThrow('MATCH_RETENTION_DAYS')
    expect(() => loadConfig({ MATCH_RETENTION_DAYS: 'много' })).toThrow('MATCH_RETENTION_DAYS')
    expect(() => loadConfig({ MAX_CONNECTIONS_PER_IP: '-1' })).toThrow('MAX_CONNECTIONS_PER_IP')
    expect(() => loadConfig({ MATCH_STARTS_PER_HOUR: '1.5' })).toThrow('MATCH_STARTS_PER_HOUR')
  })
})
