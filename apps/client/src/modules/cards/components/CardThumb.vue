<script setup lang="ts">
import type { CardForm, CardVisualState } from '../lib/card-visual'
import { computed, inject, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { DIALOG_LAYER_KEY } from '@/common/ui/dialog-layer'
import { CARD_FORM, CARD_SIZE, CARD_STATE } from '../lib/card-visual'
import CardView from './CardView.vue'

/**
 * Уменьшенная карта для окон выбора и списков: занимает в вёрстке ровно столько места, сколько видно.
 * С zoom при наведении (или фокусе) показывает над картой её увеличенную копию: на миниатюре текст способностей
 * не прочитать. Копия рисуется в слое окна (AppDialog), чтобы её не обрезала прокрутка списка.
 */
const props = withDefaults(defineProps<{
  cardId: string | null
  scale: number
  form?: CardForm
  state?: CardVisualState
  zoom?: boolean
}>(), {
  form: CARD_FORM.CARD,
  state: CARD_STATE.IDLE,
  zoom: false,
})

/** Во сколько раз увеличенная копия больше натурального размера карты. */
const ZOOM_SCALE = 1.5
const GAP = 14
const MARGIN = 8

const size = computed(() => (props.form === CARD_FORM.DEPLOYED ? CARD_SIZE.DEPLOYED : CARD_SIZE.CARD))
const boxStyle = computed(() => ({ width: `${size.value.w * props.scale}px`, height: `${size.value.h * props.scale}px` }))
const innerStyle = computed(() => ({ transform: `scale(${props.scale})` }))

const layer = inject(DIALOG_LAYER_KEY, null)
const box = useTemplateRef<HTMLElement>('box')
const zoomAt = ref<{ x: number, y: number } | null>(null)

/** Центр увеличенной копии в координатах слоя: над миниатюрой, а если сверху нет места - под ней. */
function placeZoom(): void {
  const layerEl = layer?.value
  const boxEl = box.value
  if (!layerEl || !boxEl)
    return
  const layerRect = layerEl.getBoundingClientRect()
  const rect = boxEl.getBoundingClientRect()
  // Сцена масштабируется целиком (StageScaler): переводим экранные пиксели обратно в логические.
  const k = layerRect.width / layerEl.offsetWidth
  const left = (rect.left - layerRect.left) / k
  const top = (rect.top - layerRect.top) / k
  const width = rect.width / k
  const height = rect.height / k
  const zoomW = size.value.w * ZOOM_SCALE
  const zoomH = size.value.h * ZOOM_SCALE
  const above = top - GAP - zoomH / 2
  const below = top + height + GAP + zoomH / 2
  const y = above - zoomH / 2 >= MARGIN ? above : below
  const x = Math.min(Math.max(left + width / 2, zoomW / 2 + MARGIN), layerEl.offsetWidth - zoomW / 2 - MARGIN)
  zoomAt.value = { x, y: Math.min(y, layerEl.offsetHeight - zoomH / 2 - MARGIN) }
}

function show(): void {
  if (props.zoom && props.cardId)
    placeZoom()
}

function hide(): void {
  zoomAt.value = null
}

/** Фокус с клавиатуры показывает увеличение, а начальный фокус при открытии окна (data-opening у AppDialog) - нет. */
function onFocus(): void {
  if (!box.value?.closest('[data-opening]'))
    show()
}

// Миниатюра обычно лежит внутри кнопки или фокусируемой ячейки: увеличение показывается и когда фокус пришёл на неё с клавиатуры.
let trigger: HTMLElement | null = null
onMounted(() => {
  trigger = box.value?.closest<HTMLElement>('button, [tabindex]') ?? null
  trigger?.addEventListener('focus', onFocus)
  trigger?.addEventListener('blur', hide)
})
onBeforeUnmount(() => {
  trigger?.removeEventListener('focus', onFocus)
  trigger?.removeEventListener('blur', hide)
})
</script>

<template>
  <div
    ref="box"
    class="thumb"
    :style="boxStyle"
    @pointerenter="show"
    @pointerleave="hide"
    @focusin="onFocus"
    @focusout="hide"
  >
    <div class="thumb__inner" :style="innerStyle">
      <CardView :card-id="cardId" :form="form" :state="state" />
    </div>

    <Teleport v-if="zoomAt && layer" :to="layer">
      <div
        class="thumb__zoom"
        :style="{ left: `${zoomAt.x}px`, top: `${zoomAt.y}px`, transform: `translate(-50%, -50%) scale(${ZOOM_SCALE})` }"
        aria-hidden="true"
      >
        <CardView :card-id="cardId" :form="form" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.thumb {
  position: relative;
  flex: none;
}

.thumb__inner {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

.thumb__zoom {
  position: absolute;
  z-index: 20;
  pointer-events: none;
  filter: drop-shadow(0 18px 40px rgba(0, 0, 0, 0.7));
}
</style>
