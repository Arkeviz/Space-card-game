<script setup lang="ts">
import type { IconName } from './icons'
import { computed } from 'vue'
import { ICON_ACCENT_PATHS, ICON_GRID_WIDTH, ICON_PATHS } from './icons'

const props = withDefaults(defineProps<{
  /** Иконка из общего набора. */
  name?: IconName
  /** Произвольный SVG-путь (например, эмблема фракции); приоритетнее name. */
  path?: string
  size?: number
  /** Толщина линии в единицах сетки 24x24. */
  stroke?: number
  /** Подпись для скринридера; без неё иконка считается декоративной. */
  label?: string
}>(), {
  size: 16,
  stroke: 2,
})

const d = computed(() => props.path ?? (props.name ? ICON_PATHS[props.name] : ''))
/** Ширина сетки: у широких иконок больше 24, размер size задаёт высоту. */
const gridWidth = computed(() => (props.path || !props.name ? 24 : (ICON_GRID_WIDTH[props.name] ?? 24)))
const accent = computed(() => (props.path || !props.name ? undefined : ICON_ACCENT_PATHS[props.name]))
</script>

<template>
  <svg
    class="app-icon"
    :viewBox="`0 0 ${gridWidth} 24`"
    :width="(size * gridWidth) / 24"
    :height="size"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : true"
  >
    <path :d="d" />
    <path v-if="accent" :d="accent" class="app-icon__accent" />
  </svg>
</template>

<style scoped>
.app-icon {
  flex: none;
}

.app-icon__accent {
  stroke: var(--c-combat);
}
</style>
