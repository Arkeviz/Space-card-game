<script setup lang="ts">
/*
 * Модальное окно в стиле игры (по смыслу как el-dialog): затемнение, рамка с угловыми скобками, заголовок,
 * тело с прокруткой и подвал. Рендерится на месте, а не в body: сцена игры масштабируется целиком (StageScaler),
 * и окно должно масштабироваться вместе с ней.
 */
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import { onBeforeUnmount, onMounted, useId, useTemplateRef } from 'vue'
import AppIcon from './AppIcon.vue'
import { ICON } from './icons'

const props = withDefaults(defineProps<{
  title?: string
  /** Мелкая подпись над заголовком (вид запроса: «ВЫБОР ЭФФЕКТА · ОБЯЗАТЕЛЬНО»). */
  eyebrow?: string
  width?: number
  /** Максимальная высота окна; тело прокручивается, шапка и подвал остаются на месте. */
  maxHeight?: number
  /** Показывать крестик и закрывать по Esc. Обязательные запросы (prompt) закрыть нельзя. */
  closable?: boolean
  /** Закрывать по клику вне окна; по умолчанию - как closable. */
  closeOnClickOverlay?: boolean
  /** Цвет рамки: cyan - ваши запросы, violet - запросы соперника. */
  accent?: 'cyan' | 'violet'
  zIndex?: number
}>(), {
  title: undefined,
  eyebrow: undefined,
  width: 820,
  maxHeight: 980,
  closable: false,
  closeOnClickOverlay: undefined,
  accent: 'cyan',
  zIndex: 500,
})

const emit = defineEmits<{ close: [] }>()

const titleId = useId()
const panel = useTemplateRef<HTMLElement>('panel')
let previousFocus: HTMLElement | null = null

onClickOutside(panel, () => {
  if (props.closeOnClickOverlay ?? props.closable)
    emit('close')
})
onKeyStroke('Escape', () => {
  if (props.closable)
    emit('close')
})

// Фокус - в окно (на первую кнопку тела, а не на крестик), после закрытия - обратно туда, откуда открыли.
onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const target = panel.value?.querySelector<HTMLElement>('.dialog__body button:not(:disabled), .dialog__footer button:not(:disabled)')
    ?? panel.value?.querySelector<HTMLElement>('button')
  target?.focus()
})
onBeforeUnmount(() => previousFocus?.focus())
</script>

<template>
  <div class="dialog-overlay" :style="{ zIndex }">
    <section
      ref="panel"
      class="dialog"
      :class="`dialog--${accent}`"
      :style="{ width: `${width}px`, maxHeight: `${maxHeight}px` }"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="title ? titleId : undefined"
    >
      <span class="dialog__corner dialog__corner--tl" />
      <span class="dialog__corner dialog__corner--br" />

      <header v-if="eyebrow || $slots['header-extra']" class="dialog__head">
        <div class="dialog__eyebrow">
          {{ eyebrow }}
        </div>
        <slot name="header-extra" />
      </header>

      <button v-if="closable" type="button" class="dialog__close" aria-label="Закрыть" @click="emit('close')">
        <AppIcon :name="ICON.PLUS" :size="22" class="dialog__x" />
      </button>

      <h2 v-if="title" :id="titleId" class="dialog__title">
        {{ title }}
      </h2>

      <div class="dialog__body">
        <slot />
      </div>

      <footer v-if="$slots.footer" class="dialog__footer">
        <slot name="footer" />
      </footer>
    </section>
  </div>
</template>

<style scoped>
.dialog-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(4, 7, 14, 0.68);
}

.dialog {
  --accent: var(--c-me);

  position: relative;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 26px 30px;
  background: var(--c-surface);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent), 0 30px 80px rgba(0, 0, 0, 0.65);
}

.dialog--violet {
  --accent: var(--c-opponent);
}

.dialog__corner {
  position: absolute;
  width: 16px;
  height: 16px;
}

.dialog__corner--tl {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--accent);
  border-left: 2px solid var(--accent);
}

.dialog__corner--br {
  right: -1px;
  bottom: -1px;
  border-right: 2px solid var(--accent);
  border-bottom: 2px solid var(--accent);
}

.dialog__head {
  display: flex;
  flex: none;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

.dialog__eyebrow {
  flex: 1;
  color: var(--accent);
  font: 600 11px/1 var(--font-mono);
  letter-spacing: 0.18em;
}

.dialog__title {
  flex: none;
  margin: 0;
  font: 700 28px/1.15 var(--font-display);
}

/* Отрицательный отступ и равный ему padding: прокрутка не обрезает подсветку и значки выбора у краёв карт. */
.dialog__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 22px;
  min-height: 0;
  margin: -10px;
  padding: 10px;
  overflow-y: auto;
}

.dialog__footer {
  display: flex;
  flex: none;
  gap: 14px;
  align-items: center;
  padding-top: 18px;
  border-top: 1px solid rgba(143, 163, 200, 0.16);
}

.dialog__close {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 1;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--c-text-quiet);
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.4);
  cursor: pointer;
}

.dialog__close:hover {
  color: var(--c-me);
  box-shadow: inset 0 0 0 1px var(--c-me);
}

.dialog__x {
  transform: rotate(45deg);
}
</style>
