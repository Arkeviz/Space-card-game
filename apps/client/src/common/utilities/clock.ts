function clock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** Оставшееся время: «1:05». Дробная секунда округляется вверх, чтобы отсчёт не показывал 0:00 раньше срока. */
export function formatClock(ms: number): string {
  return clock(Math.max(0, Math.ceil(ms / 1000)))
}

/** Прошедшее время: «1:05». Дробная секунда отбрасывается, чтобы счёт не убегал вперёд. */
export function formatElapsed(ms: number): string {
  return clock(Math.max(0, Math.floor(ms / 1000)))
}
