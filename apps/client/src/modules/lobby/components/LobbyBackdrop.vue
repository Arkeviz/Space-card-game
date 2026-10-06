<script setup lang="ts">
import ShaderToy from '@/common/ui/ShaderToy.vue'
import starNest from '../lib/star-nest.glsl?raw'

/**
 * Фон главного экрана и ожидания соперника: шейдер Star Nest на весь экран. Если WebGL 2 недоступен,
 * остаётся «звёздная карта» из CSS под ним (space-backdrop).
 */
</script>

<template>
  <div class="backdrop space-backdrop">
    <ShaderToy :shader-code="starNest" :brightness="0.4" :speed="0.02" :pixel-ratio="1.5" />
  </div>
</template>

<style scoped>
.backdrop {
  position: absolute;
  inset: 0;
}
</style>
