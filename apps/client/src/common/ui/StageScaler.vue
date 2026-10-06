<script setup lang="ts">
/*
 * Сцена фиксированного размера (в логических пикселях дизайна), которая масштабируется под окно с сохранением
 * пропорций. Вся вёрстка и расчёт позиций карт ведутся в этих логических пикселях, поэтому GSAP-анимации
 * и позиции слотов не зависят от размера окна.
 */
import { useWindowSize } from '@vueuse/core'
import { computed, provide, reactive } from 'vue'
import { STAGE_DIM, STAGE_DIM_KEY } from './stage-dim'

const props = withDefaults(defineProps<{
  width?: number
  height?: number
}>(), {
  width: 1920,
  height: 1080,
})

const { width: windowWidth, height: windowHeight } = useWindowSize()

// Окна и итоги внутри сцены затемняют только её; пока хотя бы один такой слой открыт, поля вокруг сцены затемняются здесь (см. stage-dim.ts).
const dimmers = reactive({ [STAGE_DIM.DIALOG]: 0, [STAGE_DIM.RESULT]: 0 })
provide(STAGE_DIM_KEY, {
  acquire(kind) {
    dimmers[kind]++
    let released = false
    return () => {
      if (!released)
        dimmers[kind]--
      released = true
    }
  },
})
// Итоги важнее окон: если открыты оба слоя, поля затемняются как под итогами.
const dimKind = computed(() => (dimmers[STAGE_DIM.RESULT] > 0 ? STAGE_DIM.RESULT : dimmers[STAGE_DIM.DIALOG] > 0 ? STAGE_DIM.DIALOG : null))

const scale = computed(() => Math.min(windowWidth.value / props.width, windowHeight.value / props.height))
const style = computed(() => ({
  width: `${props.width}px`,
  height: `${props.height}px`,
  transform: `translate(-50%, -50%) scale(${scale.value})`,
}))

/** Затемнение закрывает всё окно, кроме сцены: вырез по её прямоугольнику (с запасом в 1 px, чтобы на стыке не было светлой линии). */
const OVERLAP = 1
const dimClip = computed(() => {
  const w = props.width * scale.value
  const h = props.height * scale.value
  const left = (windowWidth.value - w) / 2 + OVERLAP
  const top = (windowHeight.value - h) / 2 + OVERLAP
  const right = left + w - 2 * OVERLAP
  const bottom = top + h - 2 * OVERLAP
  return `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${left}px ${top}px, ${left}px ${bottom}px, ${right}px ${bottom}px, ${right}px ${top}px, ${left}px ${top}px)`
})
</script>

<template>
  <div class="stage-viewport">
    <!-- Фон на всё окно, а не только на сцену: его не обрезают поля вокруг масштабированной сцены. -->
    <slot name="backdrop" />
    <div v-if="dimKind" class="stage-dim" :class="`stage-dim--${dimKind}`" :style="{ clipPath: dimClip }" aria-hidden="true" />
    <div class="stage" :style="style">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* overflow: clip, а не hidden: hidden - прокручиваемый контейнер, и фокус на карте у края сцены сдвигал бы всю сцену. */
.stage-viewport {
  position: fixed;
  inset: 0;
  overflow: clip;
  background: var(--c-bg);
}

/* На всё окно с вырезом под сцену: саму сцену затемняет окно или экран итогов. */
.stage-dim {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.stage-dim--dialog {
  background: var(--c-scrim);
}

/* Как у экрана итогов на сцене (GameOverScreen). */
.stage-dim--result {
  background: rgba(4, 7, 14, 0.5);
  backdrop-filter: blur(7px) brightness(0.5);
}

.stage {
  position: absolute;
  top: 50%;
  left: 50%;
  overflow: clip;
  transform-origin: 50% 50%;
}
</style>
