<script setup lang="ts">
/*
 * Шейдер в формате ShaderToy на весь родитель (фон). Мышь и касания не обрабатываются: картинка от курсора не меняется,
 * а сам холст не перехватывает клики. Идея и параметры - как у компонента ShaderToy из Inspira UI, отрисовка -
 * utilities/shader-renderer.ts. При prefers-reduced-motion шейдер рисуется один раз и не анимируется.
 */
import { usePreferredReducedMotion } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { ShaderRenderer } from '../utilities/shader-renderer'

const props = withDefaults(defineProps<{
  /** Код `mainImage` в формате ShaderToy (GLSL ES 3.00). */
  shaderCode: string
  /** Множитель яркости. */
  brightness?: number
  /** Множитель скорости времени шейдера. */
  speed?: number
  /** Размер холста относительно контейнера (0.25-2): больше - чётче и тяжелее. */
  pixelRatio?: number
  /** Потолок частоты кадров (1-60). */
  frameRate?: number
  paused?: boolean
}>(), {
  brightness: 1,
  speed: 1,
  pixelRatio: 1,
  frameRate: 60,
  paused: false,
})

const emit = defineEmits<{
  /** Не удалось запустить шейдер (нет WebGL 2 или ошибка компиляции): на экране остаётся то, что лежит под компонентом. */
  error: [message: string]
}>()

const container = useTemplateRef<HTMLElement>('container')
const reducedMotion = usePreferredReducedMotion()
const shouldPlay = computed(() => !props.paused && reducedMotion.value !== 'reduce')

let renderer: ShaderRenderer | undefined

function updatePlayback(): void {
  if (shouldPlay.value)
    renderer?.play()
  else
    renderer?.pause()
}

onMounted(() => {
  if (!container.value)
    return
  try {
    renderer = new ShaderRenderer(container.value, { ...props })
  }
  catch (error) {
    emit('error', error instanceof Error ? error.message : String(error))
    return
  }
  updatePlayback()
  if (!shouldPlay.value)
    renderer.render()
})
onBeforeUnmount(() => {
  renderer?.dispose()
  renderer = undefined
})

watch(() => props.brightness, value => renderer?.setBrightness(value))
watch(() => props.speed, value => renderer?.setSpeed(value))
watch(() => props.pixelRatio, value => renderer?.setPixelRatio(value))
watch(() => props.frameRate, value => renderer?.setFrameRate(value))
watch(shouldPlay, updatePlayback)
</script>

<template>
  <div ref="container" class="shader" aria-hidden="true" />
</template>

<style scoped>
.shader {
  position: absolute;
  inset: 0;
  overflow: clip;
  pointer-events: none;
}
</style>
