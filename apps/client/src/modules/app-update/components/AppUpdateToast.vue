<script setup lang="ts">
/*
 * Окно «вышла новая версия»: переносимое (за заголовок), но не закрываемое и не выходящее за границы окна браузера.
 * Через `minutes` минут страница перезагружается сама; идущая партия не теряется: токен переподключения лежит в sessionStorage.
 * Рисуется поверх всего и вне сцены (position: fixed в окне), поэтому размеры в обычных пикселях, а не в логических.
 */
import { computed, onBeforeUnmount, useTemplateRef, watch } from 'vue'
import { useDraggableInViewport } from '@/common/composables/useDraggableInViewport'
import { useTick } from '@/common/composables/useTick'
import { countdown } from '../lib/countdown'

const props = withDefaults(defineProps<{
  minutes?: number
}>(), {
  minutes: 5,
})

const emit = defineEmits<{ reload: [] }>()

const root = useTemplateRef<HTMLElement>('root')
const handle = useTemplateRef<HTMLElement>('handle')
const { style } = useDraggableInViewport(root, handle)

const startedAt = Date.now()
const now = useTick(250)
const left = computed(() => countdown(startedAt, now.value.getTime(), props.minutes * 60_000))

let reloaded = false
function reload(): void {
  if (reloaded)
    return
  reloaded = true
  emit('reload')
}

watch(() => left.value.expired, (expired) => {
  if (expired)
    reload()
})
onBeforeUnmount(() => {
  reloaded = true
})
</script>

<template>
  <div ref="root" class="toast" role="status" :style="style">
    <h2 ref="handle" class="toast__title">
      Вышла новая версия
    </h2>
    <p class="toast__text">
      Страница перезагрузится автоматически, когда полоска дойдёт до конца. Идущая партия продолжится.
    </p>
    <button class="toast__button" type="button" @click="reload">
      Перезагрузить сейчас
    </button>
    <div class="toast__bar" aria-hidden="true">
      <div class="toast__fill" :style="{ transform: `scaleX(${left.progress})` }" />
    </div>
  </div>
</template>

<style scoped>
/* Жёлтый - цвет торговли из токенов (--c-trade), как жёлтый в оформлении «Звёздных империй». */
.toast {
  position: fixed;
  z-index: 9990;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 350px;
  min-width: 350px;
  max-width: 350px;
  min-height: 100px;
  padding: 0 0 12px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--c-trade);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  color: #1b1303;
}

.toast__title {
  margin: 0;
  padding: 12px 16px 0;
  cursor: grab;
  font: 700 14px/1.2 var(--font-display);
  letter-spacing: 0.02em;
  touch-action: none;
  user-select: none;
}

.toast__title:active {
  cursor: grabbing;
}

.toast__text {
  padding: 0 16px;
  font: 500 15px/1.35 var(--font-text);
}

.toast__button {
  align-self: flex-start;
  margin: 2px 16px 0;
  padding: 6px 12px;
  border: 1px solid #1b1303;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: 600 13px/1.2 var(--font-text);
}

.toast__button:hover {
  background: #1b1303;
  color: var(--c-trade);
}

.toast__button:focus-visible {
  outline: 2px solid #1b1303;
  outline-offset: 2px;
}

.toast__bar {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 5px;
  background: rgba(27, 19, 3, 0.2);
}

.toast__fill {
  height: 100%;
  background: #1f57e6;
  transform-origin: left;
}
</style>
