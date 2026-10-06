import { PLAYER_NAME_MAX_LENGTH } from '@space/protocol'

/** Режим анимаций: «как в системе» следует prefers-reduced-motion, остальные его переопределяют. */
export const ANIMATION_MODE = {
  SYSTEM: 'system',
  FULL: 'full',
  REDUCED: 'reduced',
} as const
export type AnimationMode = (typeof ANIMATION_MODE)[keyof typeof ANIMATION_MODE]

/** Допустимые множители скорости анимаций: больше - быстрее. */
export const ANIMATION_SPEEDS = [0.75, 1, 1.5, 2] as const

/** Имя, под которым играет тот, кто своё не указал: сервер требует непустое. */
export const DEFAULT_PLAYER_NAME = 'Игрок'

export interface Settings {
  /** Пустое имя заменяется на DEFAULT_PLAYER_NAME при отправке (см. playerNameOf). */
  playerName: string
  animationSpeed: number
  animationMode: AnimationMode
  /** Предупреждать перед концом хода, если осталась неистраченная атака или торговля. */
  endTurnWarning: boolean
  /** Горячие клавиши хода: P, A, E. */
  hotkeys: boolean
  /** Перетаскивание карт мышью (клик и клавиатура работают всегда). */
  dragAndDrop: boolean
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  playerName: '',
  animationSpeed: 1,
  animationMode: ANIMATION_MODE.SYSTEM,
  endTurnWarning: true,
  hotkeys: true,
  dragAndDrop: true,
}

const ANIMATION_MODES: readonly string[] = Object.values(ANIMATION_MODE)

/** Очищает введённое имя: без управляющих символов, пробелы по краям обрезаются, длина не больше предела протокола. */
export function cleanPlayerName(raw: string): string {
  return [...raw.replace(/\p{C}/gu, '').trim()].slice(0, PLAYER_NAME_MAX_LENGTH).join('').trim()
}

/** Имя для отправки на сервер: введённое игроком или имя по умолчанию. */
export function playerNameOf(settings: Pick<Settings, 'playerName'>): string {
  return cleanPlayerName(settings.playerName) || DEFAULT_PLAYER_NAME
}

/**
 * Разбирает сохранённые настройки: каждое поле проверяется отдельно, испорченное или неизвестное значение
 * заменяется значением по умолчанию, лишние поля отбрасываются. Настройки из старой или чужой версии не ломают игру.
 */
export function parseSettings(raw: unknown): Settings {
  const source = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {}
  const bool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)
  const speed = source.animationSpeed
  const mode = source.animationMode
  return {
    playerName: typeof source.playerName === 'string' ? cleanPlayerName(source.playerName) : DEFAULT_SETTINGS.playerName,
    animationSpeed: typeof speed === 'number' && (ANIMATION_SPEEDS as readonly number[]).includes(speed) ? speed : DEFAULT_SETTINGS.animationSpeed,
    animationMode: typeof mode === 'string' && ANIMATION_MODES.includes(mode) ? mode as AnimationMode : DEFAULT_SETTINGS.animationMode,
    endTurnWarning: bool(source.endTurnWarning, DEFAULT_SETTINGS.endTurnWarning),
    hotkeys: bool(source.hotkeys, DEFAULT_SETTINGS.hotkeys),
    dragAndDrop: bool(source.dragAndDrop, DEFAULT_SETTINGS.dragAndDrop),
  }
}

/**
 * Во сколько раз ускорять анимации (слой карт делит длительности на это число): выбранная скорость, а при
 * сокращённых анимациях - почти мгновенно. reducedBySystem - prefers-reduced-motion.
 */
export const REDUCED_MOTION_FACTOR = 20

export function motionFactor(settings: Pick<Settings, 'animationSpeed' | 'animationMode'>, reducedBySystem: boolean): number {
  const reduced = settings.animationMode === ANIMATION_MODE.REDUCED || (settings.animationMode === ANIMATION_MODE.SYSTEM && reducedBySystem)
  return settings.animationSpeed * (reduced ? REDUCED_MOTION_FACTOR : 1)
}
