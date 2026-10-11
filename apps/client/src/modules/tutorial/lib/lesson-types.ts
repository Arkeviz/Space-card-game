import type { Command, GameState } from '@space/engine'
import type { Box, TourSide } from '@/common/utilities/tour-placement'

/** Вид шага обучения. */
export const STEP_KIND = {
  /** Только объяснение: игра стоит, шаг заканчивается кнопкой «Далее». */
  INFO: 'info',
  /** Игрок должен что-то сделать: из его команд разрешены только перечисленные в allow. */
  ACT: 'act',
  /** Соперник ходит по записи; шаг заканчивается, когда записанные ходы закончились. */
  AUTO: 'auto',
} as const

/** Подходит ли команда игрока к шагу. */
export type Matcher = (command: Command, state: GameState) => boolean
/** Записанный ход соперника: по состоянию находит конкретную команду (id карт заранее неизвестны). */
export type Move = (state: GameState) => Command
/** Куда указывает подсказка: селектор, прямоугольник сцены или функция от состояния (id карт зависят от партии). */
export type TargetSpec = string | Box | null | ((state: GameState) => string | Box | null)

interface StepBase {
  id: string
  title: string
  text: string
  target?: TargetSpec
  side?: TourSide
  /** Шаг пропускается, если в момент перехода к нему условие выполнено (например, атаковать уже нечем). */
  skipIf?: (state: GameState) => boolean
}

export type LessonStep = StepBase & (
  | { kind: typeof STEP_KIND.INFO, nextLabel?: string }
  | {
    kind: typeof STEP_KIND.ACT
    allow: Matcher
    /** Когда шаг считается выполненным; по умолчанию - после первой принятой команды. */
    until?: (state: GameState) => boolean
  }
  | { kind: typeof STEP_KIND.AUTO, moves: readonly Move[] }
)
