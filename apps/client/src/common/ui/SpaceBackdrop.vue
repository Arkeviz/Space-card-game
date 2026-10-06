<script setup lang="ts">
import { inject } from 'vue'
import { BACKDROP_ANIMATED_KEY } from './backdrop-animation'
import ShaderToy from './ShaderToy.vue'
import starNest from './star-nest.glsl?raw'

/**
 * Общий фон экранов (лобби, ожидание, матч): шейдер Star Nest на весь экран. Под ним лежит прежний статичный фон
 * («звёздная карта» из CSS, space-backdrop): он виден, если WebGL 2 недоступен или игрок выключил анимированный
 * фон в настройках. Выводится слотом `backdrop` у StageScaler.
 */
withDefaults(defineProps<{
  /** Потолок частоты кадров: шейдер движется очень медленно, поэтому в тяжёлых по анимации экранах его можно ограничить. */
  frameRate?: number
}>(), {
  frameRate: 60,
})

const animated = inject(BACKDROP_ANIMATED_KEY, undefined)
</script>

<template>
  <div class="backdrop space-backdrop" :class="{ 'backdrop--static': animated === false }">
    <ShaderToy v-if="animated !== false" :shader-code="starNest" :brightness="0.5" :speed="0.02" :pixel-ratio="1.5" :frame-rate="frameRate" />
  </div>
</template>

<style scoped>
.backdrop {
  position: absolute;
  inset: 0;
}

/* Прежний фон без шейдера: к сетке добавляются редкие звёзды. */
.backdrop--static::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(1.4px 1.4px at 7% 12%, rgba(230, 238, 255, 0.7), rgba(230, 238, 255, 0) 100%),
    radial-gradient(1px 1px at 18% 64%, rgba(230, 238, 255, 0.5), rgba(230, 238, 255, 0) 100%),
    radial-gradient(1.2px 1.2px at 31% 22%, rgba(230, 238, 255, 0.55), rgba(230, 238, 255, 0) 100%),
    radial-gradient(1px 1px at 44% 88%, rgba(230, 238, 255, 0.45), rgba(230, 238, 255, 0) 100%),
    radial-gradient(1.4px 1.4px at 57% 9%, rgba(230, 238, 255, 0.6), rgba(230, 238, 255, 0) 100%),
    radial-gradient(1px 1px at 66% 47%, rgba(230, 238, 255, 0.4), rgba(230, 238, 255, 0) 100%),
    radial-gradient(1.2px 1.2px at 78% 73%, rgba(230, 238, 255, 0.55), rgba(230, 238, 255, 0) 100%),
    radial-gradient(1px 1px at 86% 18%, rgba(230, 238, 255, 0.5), rgba(230, 238, 255, 0) 100%),
    radial-gradient(1.4px 1.4px at 93% 58%, rgba(230, 238, 255, 0.6), rgba(230, 238, 255, 0) 100%),
    radial-gradient(1px 1px at 12% 92%, rgba(230, 238, 255, 0.4), rgba(230, 238, 255, 0) 100%);
}
</style>
