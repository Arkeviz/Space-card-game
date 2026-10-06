export interface ServerConfig {
  port: number
  /** Строка подключения к PostgreSQL; без неё партии хранятся только в памяти процесса. */
  databaseUrl: string | undefined
  /** Сколько дней партии хранятся в базе после последнего изменения. */
  retentionDays: number
}

export const DEFAULT_PORT = 3001
export const DEFAULT_RETENTION_DAYS = 14

function positiveNumber(name: string, raw: string | undefined, fallback: number, integer: boolean): number {
  if (raw === undefined || raw.trim() === '')
    return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value)))
    throw new Error(`${name}: ожидается положительное ${integer ? 'целое ' : ''}число, получено «${raw}»`)
  return value
}

/** Настройки сервера из переменных окружения: PORT, DATABASE_URL, MATCH_RETENTION_DAYS. Неверное значение - ошибка при старте. */
export function loadConfig(env: Record<string, string | undefined>): ServerConfig {
  return {
    port: positiveNumber('PORT', env.PORT, DEFAULT_PORT, true),
    databaseUrl: env.DATABASE_URL?.trim() || undefined,
    retentionDays: positiveNumber('MATCH_RETENTION_DAYS', env.MATCH_RETENTION_DAYS, DEFAULT_RETENTION_DAYS, false),
  }
}
