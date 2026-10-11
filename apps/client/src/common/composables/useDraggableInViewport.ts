import type { MaybeRefOrGetter } from 'vue'
import { useDraggable, useElementSize, useWindowSize } from '@vueuse/core'
import { computed, onMounted, toValue, watch } from 'vue'
import { clampToViewport } from '../utilities/clamp-to-viewport'

/**
 * Делает элемент с `position: fixed` переносимым за ручку и не выпускает его за границы окна: ни при переносе,
 * ни при уменьшении окна. Начальное положение - у левого нижнего угла окна с отступом `margin`.
 */
export function useDraggableInViewport(
  target: MaybeRefOrGetter<HTMLElement | null | undefined>,
  handle: MaybeRefOrGetter<HTMLElement | null | undefined>,
  options: { margin?: number } = {},
) {
  const margin = options.margin ?? 24
  const { width: windowWidth, height: windowHeight } = useWindowSize()
  const { width, height } = useElementSize(target, undefined, { box: 'border-box' })

  // Сырое положение следует за курсором и может уйти за край: показывается ограниченное (position), поэтому у края элемент
  // «прилипает», а при возврате курсора сразу идёт за ним.
  const { x, y } = useDraggable(target, { handle, preventDefault: true, stopPropagation: true })
  const position = computed(() => clampToViewport(
    { x: x.value, y: y.value },
    { width: width.value, height: height.value },
    { width: windowWidth.value, height: windowHeight.value },
  ))

  onMounted(() => {
    x.value = margin
    y.value = window.innerHeight - (toValue(target)?.offsetHeight ?? 0) - margin
  })

  // Окно или элемент изменили размер: запоминаем уже ограниченное положение, иначе при росте окна элемент уехал бы обратно.
  watch([windowWidth, windowHeight, width, height], () => {
    x.value = position.value.x
    y.value = position.value.y
  })

  const style = computed(() => ({ left: `${position.value.x}px`, top: `${position.value.y}px` }))
  return { style }
}
