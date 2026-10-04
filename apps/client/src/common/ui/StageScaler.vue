<script setup lang="ts">
/*
 * Сцена фиксированного размера (в логических пикселях дизайна), которая масштабируется под окно с сохранением
 * пропорций. Вся вёрстка и расчёт позиций карт ведутся в этих логических пикселях, поэтому GSAP-анимации
 * и позиции слотов не зависят от размера окна.
 */
import { useWindowSize } from '@vueuse/core'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  width?: number
  height?: number
}>(), {
  width: 1920,
  height: 1080,
})

const { width: windowWidth, height: windowHeight } = useWindowSize()

const scale = computed(() => Math.min(windowWidth.value / props.width, windowHeight.value / props.height))
const style = computed(() => ({
  width: `${props.width}px`,
  height: `${props.height}px`,
  transform: `translate(-50%, -50%) scale(${scale.value})`,
}))
</script>

<template>
  <div class="stage-viewport">
    <div class="stage" :style="style">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.stage-viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--c-bg);
}

.stage {
  position: absolute;
  top: 50%;
  left: 50%;
  overflow: hidden;
  transform-origin: 50% 50%;
}
</style>
