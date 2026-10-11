<script setup lang="ts">
/*
 * Тур-подсказка (по смыслу как el-tour без маски): окно со стрелкой, привязанное к элементу экрана, и рамка вокруг
 * элемента. Не модальное: ничего не затемняет и не перехватывает ввод, поэтому игрок продолжает пользоваться
 * экраном, пока подсказка висит. Компонент показывает один шаг; какой именно и что делают кнопки, решает хозяин.
 *
 * Рисуется внутри сцены (StageScaler), поэтому позиции считаются в логических пикселях сцены: размеры элементов,
 * найденных по селектору, пересчитываются из экранных пикселей через масштаб сцены. Позиция сверяется каждый
 * кадр, пока подсказка открыта, - так окно следует за картой, которая летит по столу.
 */
import type { Box, Placed } from '../utilities/tour-placement'
import type { TourStep } from './tour'
import { useRafFn } from '@vueuse/core'
import { nextTick, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
import { placeTour, TOUR_SIDE } from '../utilities/tour-placement'
import AppIcon from './AppIcon.vue'
import GameButton from './GameButton.vue'
import { ICON } from './icons'

const props = withDefaults(defineProps<{
  open: boolean
  step: TourStep | null
  /** Номер шага (с 1) и число шагов: индикатор «3 / 12» и полоска прогресса. */
  current?: number
  total?: number
  showPrev?: boolean
  showNext?: boolean
  nextLabel?: string
  prevLabel?: string
  /** Крестик в углу: эмитит close. */
  closable?: boolean
  /** Рамка вокруг цели. */
  highlight?: boolean
  /** Переводить фокус на «Далее» при смене шага (для шагов, где от игрока нужно только прочитать). */
  autofocus?: boolean
  zIndex?: number
}>(), {
  current: 1,
  total: 1,
  showPrev: false,
  showNext: true,
  nextLabel: 'Далее',
  prevLabel: 'Назад',
  closable: false,
  highlight: true,
  autofocus: true,
  zIndex: 580,
})

const emit = defineEmits<{
  prev: []
  next: []
  close: []
}>()

const GAP = 20
const MARGIN = 16
const ARROW_INSET = 28
/** Сколько ждём появления цели, прежде чем показать окно по центру (карта могла ещё не отрисоваться). */
const TARGET_WAIT_MS = 1500
/** Плавный переезд окна к новой цели после смены шага; позже окно следует за целью без сглаживания. */
const GLIDE_MS = 320

const titleId = useId()
const descriptionId = useId()
const root = useTemplateRef<HTMLElement>('root')
const popover = useTemplateRef<HTMLElement>('popover')
const nextButton = useTemplateRef<InstanceType<typeof GameButton>>('nextButton')

const placed = ref<Placed | null>(null)
const ring = ref<Box | null>(null)
const ready = ref(false)
const gliding = ref(false)
let missingSince: number | null = null
let glideTimer: ReturnType<typeof setTimeout> | undefined

function sceneBox(element: Element, rootRect: DOMRect, scale: number): Box {
  const rect = element.getBoundingClientRect()
  return { x: (rect.left - rootRect.left) / scale, y: (rect.top - rootRect.top) / scale, w: rect.width / scale, h: rect.height / scale }
}

const same = (a: Box | null, b: Box | null): boolean => a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h)

function measure(): void {
  const rootEl = root.value
  const popoverEl = popover.value
  const { step } = props
  if (!rootEl || !popoverEl || !step)
    return
  const rootRect = rootEl.getBoundingClientRect()
  const scale = rootEl.offsetWidth > 0 ? rootRect.width / rootEl.offsetWidth : 1

  let target: Box | null = null
  let waiting = false
  if (typeof step.target === 'string') {
    const element = document.querySelector(step.target)
    if (element) {
      target = sceneBox(element, rootRect, scale)
      missingSince = null
    }
    else {
      const now = performance.now()
      missingSince ??= now
      waiting = now - missingSince < TARGET_WAIT_MS
    }
  }
  else if (step.target) {
    target = step.target
  }
  ready.value = !waiting

  const next = placeTour({
    target,
    size: { w: popoverEl.offsetWidth, h: popoverEl.offsetHeight },
    bounds: { w: rootEl.offsetWidth, h: rootEl.offsetHeight },
    side: step.side ?? TOUR_SIDE.BOTTOM,
    gap: GAP,
    margin: MARGIN,
    arrowInset: ARROW_INSET,
  })
  const current = placed.value
  if (!current || current.x !== next.x || current.y !== next.y || current.side !== next.side || current.arrow !== next.arrow)
    placed.value = next
  if (!same(ring.value, target))
    ring.value = target
}

const { pause, resume } = useRafFn(measure, { immediate: false })

watch(() => props.open, (open) => {
  if (open)
    resume()
  else
    pause()
}, { immediate: true })

watch(() => props.step?.id, async () => {
  missingSince = null
  gliding.value = placed.value !== null
  clearTimeout(glideTimer)
  glideTimer = setTimeout(() => (gliding.value = false), GLIDE_MS)
  if (props.autofocus && props.showNext && props.open) {
    await nextTick()
    // Фокус не отбираем у игрока, который сейчас работает с картами или кнопками экрана матча.
    const active = document.activeElement
    if (!active || active === document.body || active === nextButton.value?.$el || popover.value?.contains(active))
      (nextButton.value?.$el as HTMLElement | undefined)?.focus({ preventScroll: true })
  }
})

onBeforeUnmount(() => clearTimeout(glideTimer))

const RING_PAD = 6
</script>

<template>
  <div ref="root" class="tour" :style="{ zIndex }">
    <template v-if="open && step">
      <div
        v-if="highlight && ring && ready"
        class="tour__ring"
        :style="{ left: `${ring.x - RING_PAD}px`, top: `${ring.y - RING_PAD}px`, width: `${ring.w + RING_PAD * 2}px`, height: `${ring.h + RING_PAD * 2}px` }"
        aria-hidden="true"
      />

      <section
        ref="popover"
        class="tour__popover"
        :class="[`tour__popover--${placed?.side ?? 'center'}`, { 'tour__popover--ready': ready && placed, 'tour__popover--glide': gliding }]"
        :style="{ 'transform': `translate(${placed?.x ?? 0}px, ${placed?.y ?? 0}px)`, '--arrow': `${placed?.arrow ?? 0}px` }"
        role="dialog"
        aria-modal="false"
        :aria-labelledby="titleId"
        :aria-describedby="descriptionId"
      >
        <span class="tour__corner tour__corner--tl" />
        <span class="tour__corner tour__corner--br" />
        <span v-if="placed?.arrow != null" class="tour__arrow" aria-hidden="true" />

        <div class="tour__progress" aria-hidden="true">
          <div class="tour__progress-fill" :style="{ width: `${total > 0 ? (current / total) * 100 : 0}%` }" />
        </div>

        <header class="tour__head">
          <p class="tour__eyebrow">
            ОБУЧЕНИЕ
          </p>
          <p class="tour__counter">
            {{ current }} / {{ total }}
          </p>
          <button v-if="closable" type="button" class="tour__close" aria-label="Закрыть подсказки" @click="emit('close')">
            <AppIcon :name="ICON.PLUS" :size="18" class="tour__x" />
          </button>
        </header>

        <!-- aria-live: на шагах, где фокус не переводится (нужно действие на столе), скринридер всё равно озвучит новый текст. -->
        <div class="tour__body" aria-live="polite">
          <h2 :id="titleId" class="tour__title">
            {{ step.title }}
          </h2>
          <p :id="descriptionId" class="tour__text">
            {{ step.description }}
          </p>
        </div>

        <footer v-if="showPrev || showNext" class="tour__footer">
          <GameButton v-if="showPrev" variant="ghost" :height="42" @click="emit('prev')">
            {{ prevLabel }}
          </GameButton>
          <GameButton v-if="showNext" ref="nextButton" class="tour__next" :height="42" @click="emit('next')">
            {{ nextLabel }}
          </GameButton>
        </footer>
      </section>
    </template>
  </div>
</template>

<style scoped>
/* Слой на всю сцену: сам ввод не перехватывает, кликабельно только окно. */
.tour {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.tour__ring {
  position: absolute;
  box-shadow: 0 0 0 2px var(--c-me), 0 0 28px rgba(79, 216, 255, 0.5), inset 0 0 22px rgba(79, 216, 255, 0.14);
  animation: tour-ring 1.8s ease-in-out infinite;
}

@keyframes tour-ring {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.45;
  }
}

.tour__popover {
  --accent: var(--c-me);

  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 400px;
  padding: 22px 24px 20px;
  background: var(--c-surface);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent), 0 24px 60px rgba(0, 0, 0, 0.65);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease-out;
}

.tour__popover--ready {
  opacity: 1;
  pointer-events: auto;
}

.tour__popover--glide {
  transition: opacity 0.18s ease-out, transform 0.32s cubic-bezier(0.22, 0.8, 0.3, 1);
}

.tour__corner {
  position: absolute;
  width: 14px;
  height: 14px;
}

.tour__corner--tl {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--accent);
  border-left: 2px solid var(--accent);
}

.tour__corner--br {
  right: -1px;
  bottom: -1px;
  border-right: 2px solid var(--accent);
  border-bottom: 2px solid var(--accent);
}

/* Стрелка - повёрнутый квадрат на кромке, обращённой к цели; --arrow - расстояние до центра стрелки от угла окна. */
.tour__arrow {
  position: absolute;
  width: 14px;
  height: 14px;
  background: var(--c-surface);
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  transform: rotate(45deg);
}

.tour__popover--top .tour__arrow {
  bottom: -8px;
  left: calc(var(--arrow) - 7px);
  border-top-color: transparent;
  border-left-color: transparent;
}

.tour__popover--bottom .tour__arrow {
  top: -8px;
  left: calc(var(--arrow) - 7px);
  border-right-color: transparent;
  border-bottom-color: transparent;
}

.tour__popover--left .tour__arrow {
  top: calc(var(--arrow) - 7px);
  right: -8px;
  border-bottom-color: transparent;
  border-left-color: transparent;
}

.tour__popover--right .tour__arrow {
  top: calc(var(--arrow) - 7px);
  left: -8px;
  border-top-color: transparent;
  border-right-color: transparent;
}

.tour__progress {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 3px;
  background: rgba(143, 163, 200, 0.16);
}

.tour__progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease-out;
}

.tour__head {
  display: flex;
  gap: 12px;
  align-items: center;
}

.tour__eyebrow {
  flex: 1;
  color: var(--accent);
  font: 600 11px/1 var(--font-mono);
  letter-spacing: 0.2em;
}

.tour__counter {
  color: var(--c-muted);
  font: 600 11px/1 var(--font-mono);
  letter-spacing: 0.12em;
  font-variant-numeric: tabular-nums;
}

.tour__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: -6px -8px -6px 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--c-text-quiet);
  cursor: pointer;
}

.tour__close:hover {
  color: var(--c-me);
}

.tour__x {
  transform: rotate(45deg);
}

.tour__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tour__title {
  margin: 0;
  color: var(--c-text-strong);
  font: 700 20px/1.2 var(--font-display);
}

.tour__text {
  color: var(--c-text-soft);
  font: 400 17px/25px var(--font-text);
}

.tour__footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 4px;
}

.tour__next {
  min-width: 140px;
}

@media (prefers-reduced-motion: reduce) {
  .tour__ring {
    animation: none;
  }

  .tour__popover,
  .tour__popover--glide {
    transition: none;
  }
}
</style>
