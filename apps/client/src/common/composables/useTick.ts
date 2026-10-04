import { useIntervalFn, useNow } from '@vueuse/core'

/** Текущее время, обновляемое раз в intervalMs: по умолчанию useNow перерисовывается каждый кадр, для таймера это лишнее. */
export function useTick(intervalMs = 250) {
  return useNow({ scheduler: callback => useIntervalFn(callback, intervalMs) })
}
