import type { InjectionKey } from 'vue'

/**
 * Затемнение за пределами сцены. Окна и экран итогов рисуются внутри сцены и затемняют только её, а сама сцена
 * масштабируется с полями по бокам или сверху и снизу. Пока такой слой открыт, он просит у StageScaler затемнить
 * и поля тоже: `acquire(kind)` включает затемнение и возвращает функцию, которая его отпускает (слоёв может быть несколько).
 */
export const STAGE_DIM = {
  /** Модальное окно (AppDialog): ровное затемнение. */
  DIALOG: 'dialog',
  /** Экран итогов матча: затемнение с размытием, как на самой сцене. */
  RESULT: 'result',
} as const
export type StageDimKind = (typeof STAGE_DIM)[keyof typeof STAGE_DIM]

export const STAGE_DIM_KEY: InjectionKey<{ acquire: (kind: StageDimKind) => () => void }> = Symbol('stage-dim')
