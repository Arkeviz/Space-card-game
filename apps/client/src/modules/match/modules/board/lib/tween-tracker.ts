import type gsap from 'gsap'

/**
 * Анимации, которых ждёт очередь событий: шаг AnimationDirector заканчивается, когда завершились все твины,
 * начатые слоем карт после последнего изменения стола (settled).
 */
export class TweenTracker {
  private pending: Promise<void>[] = []

  /**
   * Добавляет твин в список ожидаемых. Колбэки, уже заданные у твина (снять z-index, закончить переворот),
   * сохраняются: eventCallback заменяет их, а без них карта навсегда остаётся в «летящем» состоянии
   * с 3D-контекстом, и текст на ней размыт.
   */
  track(tween: gsap.core.Animation): void {
    // Твин, завершившийся при создании (нулевая длительность), своих колбэков уже не вызовет: ждать его нельзя.
    if (tween.duration() === 0)
      return
    const complete = tween.eventCallback('onComplete')
    const interrupt = tween.eventCallback('onInterrupt')
    this.pending.push(new Promise((resolve) => {
      tween.eventCallback('onComplete', () => {
        complete?.call(tween)
        resolve()
      })
      // Перезапущенная твином карта (быстрое наведение, новый ход) не должна подвешивать очередь событий.
      tween.eventCallback('onInterrupt', () => {
        interrupt?.call(tween)
        resolve()
      })
    }))
  }

  /** Произвольное ожидание (например, «распад уже заметен» у утилизации). */
  add(promise: Promise<void>): void {
    this.pending.push(promise)
  }

  /** Забирает всё накопленное и разрешается, когда оно завершилось. */
  async settled(): Promise<void> {
    const running = this.pending.splice(0)
    await Promise.all(running)
  }
}
