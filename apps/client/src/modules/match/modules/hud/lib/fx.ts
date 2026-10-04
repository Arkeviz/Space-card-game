import type { ValueOf } from '@space/engine'

/** Где всплывает число: рядом с авторитетом игроков и пулами хода. */
export const FX_TARGET = {
  SELF_AUTHORITY: 'self-authority',
  OPPONENT_AUTHORITY: 'opponent-authority',
  TRADE: 'trade',
  COMBAT: 'combat',
} as const
export type FxTarget = ValueOf<typeof FX_TARGET>

export const FX_TONE = {
  GAIN: 'gain',
  LOSS: 'loss',
} as const
export type FxTone = ValueOf<typeof FX_TONE>

/** Всплывающее число: «+2», «-3». Живёт недолго, потом MatchScreen его убирает. */
export interface FxItem {
  id: number
  target: FxTarget
  text: string
  tone: FxTone
}

/** Крупная надпись по центру поля: смена хода. */
export interface TurnBanner {
  id: number
  text: string
  mine: boolean
}

export const FX_LIFETIME_MS = 1400
export const BANNER_LIFETIME_MS = 1500
