<script setup lang="ts">
/*
 * Сцена фиксированного размера (в логических пикселях дизайна), которая масштабируется под окно с сохранением
 * пропорций. Вся вёрстка и расчёт позиций карт ведутся в этих логических пикселях, поэтому GSAP-анимации
 * и позиции слотов не зависят от размера окна.
 */
import { useWindowSize } from '@vueuse/core'
import { computed, provide, ref } from 'vue'
import { STAGE_DIM_KEY } from './stage-dim'

const props = withDefaults(defineProps<{
  width?: number
  height?: number
}>(), {
  width: 1920,
  height: 1080,
})

const { width: windowWidth, height: windowHeight } = useWindowSize()

// Окна внутри сцены затемняют только её; пока хотя бы одно открыто, поля вокруг сцены затемняются здесь (см. stage-dim.ts).
const dimmers = ref(0)
provide(STAGE_DIM_KEY, {
  acquire() {
    dimmers.value++
    let released = false
    return () => {
      if (!released)
        dimmers.value--
      released = true
    }
  },
})

const scale = computed(() => Math.min(windowWidth.value / props.width, windowHeight.value / props.height))
const style = computed(() => ({
  width: `${props.width}px`,
  height: `${props.height}px`,
  transform: `translate(-50%, -50%) scale(${scale.value})`,
}))
</script>

<template>
  <div class="stage-viewport">
    <!-- Фон на всё окно, а не только на сцену: его не обрезают поля вокруг масштабированной сцены. -->
    <slot name="backdrop" />
    <div v-if="dimmers > 0" class="stage-dim" :style="style" aria-hidden="true" />
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

/* Рамка размером со сцену: тень-«разлив» затемняет всё вокруг неё, а саму сцену (её затемняет окно) не трогает. */
.stage-dim {
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: 50% 50%;
  box-shadow: 0 0 0 10000px var(--c-scrim);
  pointer-events: none;
}

.stage {
  position: absolute;
  top: 50%;
  left: 50%;
  overflow: clip;
  transform-origin: 50% 50%;
}
</style>
