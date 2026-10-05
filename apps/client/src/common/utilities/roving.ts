/** Прямоугольник элемента на экране (как у getBoundingClientRect). */
export interface Box {
  left: number
  top: number
  width: number
  height: number
}

export type RovingKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End'

export const ROVING_KEYS: ReadonlySet<string> = new Set<RovingKey>(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'])

const centerX = (box: Box): number => box.left + box.width / 2
const centerY = (box: Box): number => box.top + box.height / 2

/**
 * Куда уйдёт фокус в сетке элементов (карты в окне, варианты выбора) по клавише навигации. boxes - элементы в порядке
 * разметки. Влево и вправо - соседний элемент по порядку, Home и End - крайние, вверх и вниз - ближайший ряд выше или
 * ниже и в нём элемент, ближайший по горизонтали. null - идти некуда.
 */
export function rovingTarget(boxes: readonly Box[], from: number, key: RovingKey): number | null {
  if (boxes.length === 0 || from < 0 || from >= boxes.length)
    return null
  if (key === 'Home')
    return 0
  if (key === 'End')
    return boxes.length - 1
  if (key === 'ArrowLeft')
    return from > 0 ? from - 1 : null
  if (key === 'ArrowRight')
    return from < boxes.length - 1 ? from + 1 : null

  const current = boxes[from]!
  const direction = key === 'ArrowDown' ? 1 : -1
  // Рядом по вертикали считаются элементы, центр которых заметно выше или ниже текущего (а не в том же ряду).
  const threshold = current.height / 2
  const candidates = boxes
    .map((box, index) => ({ index, dy: (centerY(box) - centerY(current)) * direction }))
    .filter(item => item.dy > threshold)
  if (candidates.length === 0)
    return null
  const nearestRow = Math.min(...candidates.map(item => item.dy))
  // В ближайший ряд входят все элементы, чей центр отличается от самого близкого меньше чем на полвысоты.
  const row = candidates.filter(item => item.dy - nearestRow < threshold)
  return row.reduce((best, item) =>
    Math.abs(centerX(boxes[item.index]!) - centerX(current)) < Math.abs(centerX(boxes[best.index]!) - centerX(current)) ? item : best).index
}
