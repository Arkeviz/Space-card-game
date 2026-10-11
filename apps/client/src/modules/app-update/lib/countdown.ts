export interface Countdown {
  remainingMs: number
  /** Доля оставшегося времени: 1 в начале, 0 в конце. */
  progress: number
  expired: boolean
}

export function countdown(startedAtMs: number, nowMs: number, totalMs: number): Countdown {
  const remainingMs = Math.min(totalMs, Math.max(0, startedAtMs + totalMs - nowMs))
  return { remainingMs, progress: totalMs > 0 ? remainingMs / totalMs : 0, expired: remainingMs === 0 }
}
