<script setup lang="ts">
import type { PortalState } from '../utilities/portal-transition'
import { reactive } from 'vue'
import portal from './portal.glsl?raw'
import ShaderToy from './ShaderToy.vue'

/**
 * Портал поверх всего приложения: слой для перехода из поиска в матч. Круг с крутящейся белой каймой и синими
 * вихрями, в центре - имя, VS и имя соперника столбиком (длинные имена так помещаются). Пока `active` выключен, слой скрыт, а шейдер стоит на паузе.
 * Размером, раскрытием и текстом управляют снаружи, меняя `state` (его двигает GSAP в utilities/portal-transition.ts).
 */
defineProps<{
  active: boolean
  /** Имена игроков: ваше и соперника. */
  names: { self: string, opponent: string }
}>()

const emit = defineEmits<{
  /** Шейдер не запустился (нет WebGL 2): переход нужно пропустить. */
  error: [message: string]
}>()

const state = reactive<PortalState>({ appear: 0, open: 0, black: 0, names: 0 })
defineExpose({ state })
</script>

<template>
  <div class="portal" :class="{ 'portal--active': active }" aria-hidden="true">
    <ShaderToy
      :shader-code="portal"
      transparent
      :paused="!active"
      :uniforms="{ uAppear: state.appear, uOpen: state.open, uBlack: state.black }"
      @error="emit('error', $event)"
    />
    <p class="portal__names" :style="{ opacity: state.names, transform: `scale(${0.88 + 0.12 * state.names})` }">
      <span class="portal__name">{{ names.self }}</span>
      <span class="portal__vs">VS</span>
      <span class="portal__name">{{ names.opponent }}</span>
    </p>
  </div>
</template>

<style scoped>
/* Над всем, пока идёт переход, и не пускает клики к экрану под собой. Диаметр портала - 72% меньшей стороны окна (portal.glsl). */
.portal {
  --portal-size: calc(min(100vw, 100vh) * 0.72);

  position: fixed;
  inset: 0;
  z-index: 1000;
  visibility: hidden;
  pointer-events: none;
}

.portal--active {
  visibility: visible;
  pointer-events: auto;
}

.portal__names {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  gap: calc(var(--portal-size) * 0.03);
  align-items: center;
  justify-content: center;
  width: calc(var(--portal-size) * 0.86);
  margin: 0;
  color: var(--c-text-strong);
  font: 800 calc(var(--portal-size) * 0.046) / 1.2 var(--font-display);
  /* Свечение через filter, а не text-shadow: у имён overflow: hidden (многоточие) обрезал бы тень по прямоугольнику. */
  filter: drop-shadow(0 0 10px rgba(79, 216, 255, 0.85)) drop-shadow(0 0 28px rgba(40, 110, 255, 0.7));
  translate: -50% -50%;
}

.portal__name {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.portal__vs {
  flex: none;
  color: var(--c-me);
  font-family: var(--font-mono);
  font-size: 0.6em;
  letter-spacing: 0.3em;
}
</style>
