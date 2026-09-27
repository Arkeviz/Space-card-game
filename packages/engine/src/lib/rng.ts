export interface Rng {
  /** Число в диапазоне [0, 1). */
  next: () => number
  /** Целое число в диапазоне [0, max). */
  int: (max: number) => number
  /** Перемешивает копию массива (Fisher-Yates). */
  shuffle: <T>(items: readonly T[]) => T[]
  /** Текущее внутреннее состояние: createRng(state) продолжает ту же последовательность. */
  state: () => number
}

/** Детерминированный генератор (mulberry32): один сид - одна последовательность. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0

  const next = (): number => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (max: number): number => Math.floor(next() * max)

  const shuffle = <T>(items: readonly T[]): T[] => {
    const result = [...items]
    for (let i = result.length - 1; i > 0; i--) {
      const j = int(i + 1)
      ;[result[i], result[j]] = [result[j]!, result[i]!]
    }
    return result
  }

  return { next, int, shuffle, state: () => state }
}
