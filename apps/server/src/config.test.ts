import { describe, expect, it } from 'vitest'
import { DEFAULT_PORT, DEFAULT_RETENTION_DAYS, loadConfig } from './config.ts'

describe('loadConfig', () => {
  it('без переменных - значения по умолчанию и работа без базы', () => {
    expect(loadConfig({})).toEqual({ port: DEFAULT_PORT, databaseUrl: undefined, retentionDays: DEFAULT_RETENTION_DAYS })
  })

  it('читает порт, строку подключения и срок хранения', () => {
    expect(loadConfig({ PORT: '8080', DATABASE_URL: ' postgres://u:p@db/space ', MATCH_RETENTION_DAYS: '7' })).toEqual({
      port: 8080,
      databaseUrl: 'postgres://u:p@db/space',
      retentionDays: 7,
    })
  })

  it('пустые значения считаются незаданными', () => {
    expect(loadConfig({ PORT: '', DATABASE_URL: '  ', MATCH_RETENTION_DAYS: '' })).toEqual({ port: DEFAULT_PORT, databaseUrl: undefined, retentionDays: DEFAULT_RETENTION_DAYS })
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
  })
})
