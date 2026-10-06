import { DEFAULT_LIMITS } from './limits.ts'

export interface ServerConfig {
  port: number
  /** Строка подключения к PostgreSQL; без неё партии хранятся только в памяти процесса. */
  databaseUrl: string | undefined
  /** Сколько дней партии хранятся в базе после последнего изменения. */
  retentionDays: number
  /** Каким прокси верить в X-Forwarded-For (адреса, подсети, `uniquelocal` и т. п. через запятую); undefined - никаким. */
  trustProxy: string | undefined
  /** Сколько соединений держится с одного адреса; 0 - без предела. */
  maxConnectionsPerIp: number
  /** Сколько матчей в час можно начать с одного адреса; 0 - без предела. */
  matchStartsPerHour: number
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

function nonNegativeInteger(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '')
    return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`${name}: ожидается целое число не меньше 0, получено «${raw}»`)
  return value
}

/**
 * Настройки сервера из переменных окружения: PORT, DATABASE_URL, MATCH_RETENTION_DAYS, TRUST_PROXY,
 * MAX_CONNECTIONS_PER_IP, MATCH_STARTS_PER_HOUR. Неверное значение - ошибка при старте.
 */
export function loadConfig(env: Record<string, string | undefined>): ServerConfig {
  return {
    port: positiveNumber('PORT', env.PORT, DEFAULT_PORT, true),
    databaseUrl: env.DATABASE_URL?.trim() || undefined,
    retentionDays: positiveNumber('MATCH_RETENTION_DAYS', env.MATCH_RETENTION_DAYS, DEFAULT_RETENTION_DAYS, false),
    trustProxy: env.TRUST_PROXY?.trim() || undefined,
    maxConnectionsPerIp: nonNegativeInteger('MAX_CONNECTIONS_PER_IP', env.MAX_CONNECTIONS_PER_IP, DEFAULT_LIMITS.maxConnectionsPerIp),
    matchStartsPerHour: nonNegativeInteger('MATCH_STARTS_PER_HOUR', env.MATCH_STARTS_PER_HOUR, DEFAULT_LIMITS.matchStartsPerHour),
  }
}
