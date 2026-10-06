import type { MatchRepository } from './repository.ts'

const DAY_MS = 24 * 60 * 60 * 1000
export const DEFAULT_RETENTION_CHECK_MS = 60 * 60 * 1000

interface RetentionOptions {
  /** Сколько дней партия хранится после последнего изменения. */
  days: number
  /** Как часто проверять. */
  intervalMs?: number
  /** Сообщить, сколько партий удалено. */
  onRemoved?: (count: number) => void
  onError?: (error: unknown) => void
}

/** Партии, которые не менялись дольше срока хранения, удаляются вместе с логом команд. cutoff - граница по updated_at. */
export function retentionCutoff(now: number, days: number): Date {
  return new Date(now - days * DAY_MS)
}

/**
 * Удаляет устаревшие партии сразу и затем раз в intervalMs. Сервер один, запрос идемпотентный, поэтому внешний cron
 * не нужен. Возвращает функцию остановки.
 */
export function startRetention(repository: MatchRepository, options: RetentionOptions): () => void {
  const run = async (): Promise<void> => {
    try {
      const removed = await repository.deleteOlderThan(retentionCutoff(Date.now(), options.days))
      if (removed > 0)
        options.onRemoved?.(removed)
    }
    catch (error) {
      options.onError?.(error)
    }
  }
  void run()
  const timer = setInterval(run, options.intervalMs ?? DEFAULT_RETENTION_CHECK_MS)
  timer.unref()
  return () => clearInterval(timer)
}
