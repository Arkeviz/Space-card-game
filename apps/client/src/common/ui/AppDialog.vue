<script setup lang="ts">
/*
 * Модальное окно в стиле игры (по смыслу как el-dialog): затемнение, рамка с угловыми скобками, заголовок,
 * тело с прокруткой и подвал. Рендерится на месте, а не в body: сцена игры масштабируется целиком (StageScaler),
 * и окно должно масштабироваться вместе с ней.
 */
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import { onBeforeUnmount, onMounted, provide, useId, useTemplateRef } from 'vue'
import { useStageDim } from '../composables/useStageDim'
import AppIcon from './AppIcon.vue'
import { DIALOG_LAYER_KEY } from './dialog-layer'
import { ICON } from './icons'

const props = withDefaults(defineProps<{
  title?: string
  /** Мелкая подпись над заголовком (вид запроса: «ВЫБОР ЭФФЕКТА · ОБЯЗАТЕЛЬНО»). */
  eyebrow?: string
  width?: number
  /** Максимальная высота окна; тело прокручивается, шапка и подвал остаются на месте. */
  maxHeight?: number
  /**
   * Положение по вертикали. `center` - по центру сцены, верх окна зависит от высоты содержимого. `top` - верхняя кромка
   * там, где она у окна максимальной высоты, и не двигается при смене содержимого (окна с переключаемыми разделами).
   */
  anchor?: 'center' | 'top'
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
  anchor: 'center',
  closable: false,
  closeOnClickOverlay: undefined,
  accent: 'cyan',
  zIndex: 500,
})

const emit = defineEmits<{ close: [] }>()

const titleId = useId()
const panel = useTemplateRef<HTMLElement>('panel')
provide(DIALOG_LAYER_KEY, useTemplateRef<HTMLElement>('overlay'))
let previousFocus: HTMLElement | null = null

// Окно затемняет сцену, а поля вокруг неё затемняет StageScaler.
useStageDim()

onClickOutside(panel, () => {
  if (props.closeOnClickOverlay ?? props.closable)
    emit('close')
})
onKeyStroke('Escape', () => {
  if (props.closable)
    emit('close')
})

/** Элементы окна, до которых доходит Tab (roving-элементы с tabindex -1 в обход не входят). */
const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'

/**
 * Окно модальное: Tab и Shift+Tab ходят по кругу внутри него, а не уходят на стол под затемнением. Если фокус
 * по какой-то причине оказался снаружи (кликнули мимо кнопки), следующий Tab возвращает его в окно.
 */
onKeyStroke('Tab', (event) => {
  const root = panel.value
  if (!root)
    return
  const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(element => element.offsetParent !== null)
  if (items.length === 0) {
    event.preventDefault()
    return
  }
  const first = items[0]!
  const last = items.at(-1)!
  const active = document.activeElement
  if (!root.contains(active)) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  }
  else if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
})

// Фокус - в окно (на первую кнопку тела, а не на крестик), после закрытия - обратно туда, откуда открыли.
// Пока идёт это начальное перемещение, окно помечено data-opening: миниатюры карт по такому фокусу не показывают увеличение.
onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const target = panel.value?.querySelector<HTMLElement>('.dialog__body :is(button:not(:disabled), [tabindex="0"]), .dialog__footer button:not(:disabled)')
    ?? panel.value?.querySelector<HTMLElement>('button')
  panel.value?.setAttribute('data-opening', '')
  target?.focus()
  panel.value?.removeAttribute('data-opening')
})
onBeforeUnmount(() => previousFocus?.focus())
</script>

<template>
  <div ref="overlay" class="dialog-overlay" :class="`dialog-overlay--${anchor}`" :style="{ zIndex, '--dialog-max-height': `${maxHeight}px` }">
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
        <p class="dialog__eyebrow">
          {{ eyebrow }}
        </p>
        <slot name="header-extra" />
      </header>

      <button v-if="closable" type="button" class="dialog__close" aria-label="Закрыть" @click="emit('close')">
        <AppIcon :name="ICON.PLUS" :size="22" class="dialog__x" />
      </button>

      <h2 v-if="title" :id="titleId" class="dialog__title">
        {{ title }}
      </h2>

      <!-- Под заголовком, вне прокрутки: переключатели разделов и подобное, что не должно уезжать вместе с телом. -->
      <div v-if="$slots.toolbar" class="dialog__toolbar">
        <slot name="toolbar" />
      </div>

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
  background: var(--c-scrim);
}

/* Колонкой, чтобы распорка сверху (половина свободной высоты при максимальной высоте окна) считалась от высоты сцены. */
.dialog-overlay--top {
  flex-direction: column;
  justify-content: flex-start;
}

.dialog-overlay--top::before {
  content: '';
  flex: none;
  height: calc((100% - var(--dialog-max-height)) / 2);
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
  font: 600 13px/1 var(--font-mono);
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

.dialog__toolbar {
  flex: none;
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
