/**
 * Пределы, которые не дают одному клиенту перегрузить сервер. Значения по умолчанию с большим запасом рассчитаны на
 * живого игрока: клиент шлёт команды по одной и ждёт ответа, heartbeat - раз в 15 секунд.
 */
export interface Limits {
  /** Наибольшее сообщение клиента, байт. Самое длинное настоящее (сброс 20 карт одним ответом) - меньше килобайта. */
  maxMessageBytes: number
  /** Сколько сообщений в секунду в среднем может слать один сокет; чаще - соединение закрывается. */
  messagesPerSecond: number
  /** Сколько сообщений подряд допускается сверх среднего (всплеск). */
  messageBurst: number
  /** Сколько соединений сервер держит всего. */
  maxConnections: number
  /** Сколько соединений держится с одного адреса; 0 - без предела. */
  maxConnectionsPerIp: number
  /**
   * Сколько раз в час с одного адреса можно создать матч, войти по коду, встать в поиск или предложить реванш
   * (каждая партия - запись в базе); 0 - без предела.
   */
  matchStartsPerHour: number
  /** Сколько таких действий подряд допускается сверх среднего. */
  matchStartBurst: number
  /** Как часто сервер шлёт ping. Сокет, не ответивший pong до следующего ping, закрывается. */
  heartbeatIntervalMs: number
}

export const DEFAULT_LIMITS: Limits = {
  maxMessageBytes: 4096,
  messagesPerSecond: 20,
  messageBurst: 40,
  maxConnections: 2000,
  maxConnectionsPerIp: 20,
  matchStartsPerHour: 60,
  matchStartBurst: 20,
  heartbeatIntervalMs: 30_000,
}

export const HOUR_MS = 60 * 60 * 1000

/** Ведро токенов: capacity действий подряд, дальше - по ratePerMs в миллисекунду. Время передаётся снаружи. */
export class TokenBucket {
  private readonly capacity: number
  private readonly ratePerMs: number
  private tokens: number
  private updatedAt: number

  constructor(capacity: number, ratePerMs: number, now: number) {
    this.capacity = capacity
    this.ratePerMs = ratePerMs
    this.tokens = capacity
    this.updatedAt = now
  }

  /** Забирает токен; false - ведро пусто, действие отклоняется. */
  take(now: number): boolean {
    this.refill(now)
    if (this.tokens < 1)
      return false
    this.tokens -= 1
    return true
  }

  /** Ведро снова полное: запись о нём можно удалить, ничего не потеряв. */
  isFull(now: number): boolean {
    this.refill(now)
    return this.tokens >= this.capacity
  }

  private refill(now: number): void {
    // Часы могли уйти назад (перевод системного времени): токены от этого не убывают.
    const elapsed = Math.max(0, now - this.updatedAt)
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.ratePerMs)
    this.updatedAt = now
  }
}

/**
 * Ключ адреса клиента для лимитов. IPv4 внутри IPv6 (`::ffff:1.2.3.4`) приводится к IPv4, IPv6 - к сети /64:
 * у одного абонента обычно целая такая сеть, и лимит по отдельным адресам обходился бы их сменой.
 */
export function clientKey(ip: string | undefined): string {
  if (!ip)
    return 'unknown'
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)
  if (mapped)
    return mapped[1]!
  if (!ip.includes(':'))
    return ip

  const address = ip.split('%')[0]!.toLowerCase()
  const [head = '', tail] = address.split('::')
  const headGroups = head ? head.split(':') : []
  const tailGroups = tail ? tail.split(':') : []
  const groups = tail === undefined
    ? headGroups
    : [...headGroups, ...Array.from<string>({ length: 8 - headGroups.length - tailGroups.length }).fill('0'), ...tailGroups]
  return `${groups.slice(0, 4).map(group => Number.parseInt(group, 16).toString(16)).join(':')}::/64`
}
