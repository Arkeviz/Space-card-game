import type { Box, TourSide } from '../utilities/tour-placement'

/**
 * Шаг тура (по смыслу как el-tour-step): окно с заголовком и текстом, привязанное к элементу.
 * target - CSS-селектор элемента, прямоугольник в координатах сцены или null (окно по центру).
 */
export interface TourStep {
  id: string
  title: string
  description: string
  target?: string | Box | null
  /** Предпочтительная сторона окна относительно цели; если там нет места, окно встанет с другой. */
  side?: TourSide
}
