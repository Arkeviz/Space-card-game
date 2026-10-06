<script setup lang="ts">
import { computePosition, flip, offset, shift } from '@floating-ui/dom'
import { useEventListener } from '@vueuse/core'
import { nextTick, ref } from 'vue'

/*
 * Единая подсказка для всего приложения. Монтируется один раз в корне и слушает события документа: любой элемент
 * с атрибутом data-tip="текст" получает подсказку при наведении.
 *
 * Карты на столе закрыты невидимой кнопкой (pointer-events у их содержимого отключены), поэтому курсор не попадает
 * в значки напрямую. Для таких кнопок задан data-tip-scope: подсказка берётся у значка внутри родителя кнопки,
 * над которым сейчас курсор (по координатам).
 *
 * Подсказка лежит вне сцены (у неё свой масштаб и overflow: clip), поэтому размер текста не зависит от размера окна.
 * Позицию считает Floating UI: над элементом, с переворотом вниз и сдвигом, если не помещается.
 */
const SHOW_DELAY_MS = 350
const GAP = 10
const EDGE = 8

const text = ref('')
const visible = ref(false)
const tooltip = ref<HTMLElement | null>(null)
const position = ref({ x: 0, y: 0 })

let current: Element | null = null
let timer: ReturnType<typeof setTimeout> | undefined

interface Found {
  element: Element
  tip: string
}

function contains(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

function findTip(event: PointerEvent): Found | null {
  const target = event.target
  if (!(target instanceof Element))
    return null
  const direct = target.closest<HTMLElement>('[data-tip]')
  if (direct?.dataset.tip)
    return { element: direct, tip: direct.dataset.tip }
  const scope = target.closest('[data-tip-scope]')?.parentElement
  for (const element of scope?.querySelectorAll<HTMLElement>('[data-tip]') ?? []) {
    if (element.dataset.tip && contains(element.getBoundingClientRect(), event.clientX, event.clientY))
      return { element, tip: element.dataset.tip }
  }
  return null
}

function hide(): void {
  clearTimeout(timer)
  timer = undefined
  current = null
  visible.value = false
}

async function show(found: Found): Promise<void> {
  text.value = found.tip
  visible.value = true
  await nextTick()
  if (!tooltip.value || current !== found.element)
    return
  const placed = await computePosition(found.element, tooltip.value, {
    strategy: 'fixed',
    placement: 'top',
    middleware: [offset(GAP), flip(), shift({ padding: EDGE })],
  })
  position.value = { x: Math.round(placed.x), y: Math.round(placed.y) }
}

function onPointerMove(event: PointerEvent): void {
  const found = findTip(event)
  if (!found) {
    if (current)
      hide()
    return
  }
  if (found.element === current)
    return
  // Пока подсказка уже открыта, соседний значок показывает свою без задержки.
  const wasVisible = visible.value
  hide()
  current = found.element
  if (wasVisible)
    void show(found)
  else
    timer = setTimeout(() => void show(found), SHOW_DELAY_MS)
}

useEventListener(document, 'pointermove', onPointerMove, { passive: true })
useEventListener(document, 'pointerdown', hide, { passive: true })
useEventListener(document, 'wheel', hide, { passive: true })
useEventListener(document, 'keydown', hide, { passive: true })
useEventListener(document.documentElement, 'pointerleave', hide, { passive: true })
useEventListener(window, 'blur', hide)
</script>

<template>
  <div
    ref="tooltip"
    class="tooltip"
    :class="{ 'tooltip--visible': visible }"
    role="tooltip"
    aria-hidden="true"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
  >
    {{ text }}
  </div>
</template>

<style scoped>
.tooltip {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 10000;
  max-width: 320px;
  padding: 8px 12px;
  background: #0b1222;
  color: var(--c-text-strong);
  font: 500 14px/20px var(--font-text);
  box-shadow: inset 0 0 0 1px rgba(79, 216, 255, 0.55), 0 8px 24px rgba(0, 0, 0, 0.55);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease-out;
}

.tooltip--visible {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .tooltip {
    transition: none;
  }
}
</style>
