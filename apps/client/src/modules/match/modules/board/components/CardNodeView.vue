<script setup lang="ts">
import type { CardNode, NavKey } from '../lib/nodes'
import { computed } from 'vue'
import AppIcon from '@/common/ui/AppIcon.vue'
import { ICON } from '@/common/ui/icons'
import { ABILITY_STATUS, CARD_FORM, CARD_SIZE, CARD_STATE, cardName, CardView } from '@/modules/cards'

/*
 * Одна карта на столе: невидимая кнопка сверху (клик, фокус, подпись для скринридера), под ней двусторонняя
 * карта, которую можно перевернуть через rotationY (CSS 3D). Позицию и поворот всей карты задаёт CardLayer.
 */
const props = defineProps<{ node: CardNode }>()

const emit = defineEmits<{
  click: [node: CardNode]
  highlight: [key: string | null]
  scrap: [node: CardNode]
  /** Фокус пришёл на карту (запоминается как точка входа группы для Tab). */
  focused: [node: CardNode]
  /** Клавиша навигации стрелками между картами. */
  navigate: [node: CardNode, key: NavKey]
}>()

const NAV_KEYS = new Set<string>(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'])

function onKeydown(event: KeyboardEvent): void {
  if (!NAV_KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey)
    return
  event.preventDefault()
  emit('navigate', props.node, event.key as NavKey)
}

function onFocus(): void {
  emit('highlight', props.node.key)
  emit('focused', props.node)
}

/** Карта руки в режиме выбора для сброса - переключатель: aria-pressed показывает, выбрана ли она. */
const pressed = computed(() => (props.node.state === CARD_STATE.SELECTED ? true : props.node.state === CARD_STATE.SELECTABLE ? false : undefined))
const size = computed(() => (props.node.form === CARD_FORM.DEPLOYED ? CARD_SIZE.DEPLOYED : CARD_SIZE.CARD))
const style = computed(() => ({ width: `${size.value.w}px`, height: `${size.value.h}px` }))
/** Эффект карты или базы можно активировать прямо сейчас: вокруг неё идёт пульсация. */
const activatable = computed(() => props.node.click !== null && (props.node.basic === ABILITY_STATUS.READY || props.node.ally === ABILITY_STATUS.READY))
const scrapLabel = computed(() => (props.node.cardId ? `Утилизировать «${cardName(props.node.cardId)}»` : ''))
</script>

<template>
  <div class="node" :class="{ 'node--hidden': !node.cardId }" :data-key="node.key" :style="style">
    <!-- Две волны со сдвигом лежат под картой: видна только та часть, что расходится за её контур. -->
    <template v-if="activatable">
      <span class="node__pulse" aria-hidden="true" />
      <span class="node__pulse node__pulse--late" aria-hidden="true" />
    </template>
    <div class="node__flip" data-flip>
      <div class="node__face node__face--back">
        <CardView :form="CARD_FORM.BACK" />
      </div>
      <div v-if="node.cardId" class="node__face node__face--front">
        <CardView
          :card-id="node.cardId"
          :form="node.form"
          :state="node.state"
          :basic="node.basic"
          :ally="node.ally"
          :scrap="node.scrap"
          :copy-of="node.copyOf"
        />
      </div>
    </div>

    <button
      v-if="node.click"
      type="button"
      class="node__hit"
      :class="{ 'node__hit--liftable': node.liftable }"
      :aria-label="node.label"
      :aria-pressed="pressed"
      :tabindex="node.tabbable ? 0 : -1"
      @click="emit('click', node)"
      @keydown="onKeydown"
      @pointerenter="emit('highlight', node.key)"
      @pointerleave="emit('highlight', null)"
      @focus="onFocus"
      @blur="emit('highlight', null)"
    />
    <div
      v-else-if="!node.decorative"
      class="node__hit node__hit--inert"
      role="img"
      :aria-label="node.label"
      @pointerenter="emit('highlight', node.key)"
      @pointerleave="emit('highlight', null)"
    />

    <button
      v-if="node.scrapCommand"
      type="button"
      class="node__scrap"
      :tabindex="node.tabbable ? 0 : -1"
      :aria-label="scrapLabel"
      :title="scrapLabel"
      @click="emit('scrap', node)"
    >
      <AppIcon :name="ICON.SCRAP" :size="18" />
    </button>
  </div>
</template>

<style scoped>
/*
 * Объёмные свойства (perspective, preserve-3d, backface-visibility) нужны только на время переворота карты и
 * включаются классом node--flipping. Пока карта просто лежит, она рисуется как обычный плоский слой: в 3D-контексте
 * браузер растрирует её в одном масштабе и потом растягивает/сжимает, и текст на картах получается мутным.
 */
.node {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.node__flip {
  position: absolute;
  inset: 0;
}

.node__pulse {
  position: absolute;
  inset: 0;
  background: rgba(79, 216, 255, 0.55);
  clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
  animation: node-pulse 1.8s ease-out infinite;
  pointer-events: none;
}

.node__pulse--late {
  animation-delay: 0.9s;
}

@keyframes node-pulse {
  from {
    opacity: 0.8;
    transform: scale(1);
  }

  to {
    opacity: 0;
    transform: scale(1.16);
  }
}

@media (prefers-reduced-motion: reduce) {
  .node__pulse {
    animation: none;
    opacity: 0.35;
    transform: scale(1.04);
  }

  .node__pulse--late {
    display: none;
  }
}

/* Копии для эффекта расщепления (CardLayer): вспышка по контуру и осколки, обрезанные по клеткам. */
.node--flash {
  background: radial-gradient(circle at 50% 50%, rgba(255, 236, 200, 0.95) 0%, rgba(255, 150, 80, 0.7) 60%, rgba(255, 90, 79, 0.5) 100%);
  clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
  pointer-events: none;
}

.node--shard {
  /* filter срабатывает до обрезки, поэтому тень осколку не нарисовать: вместо неё осколок раскаляется. */
  filter: brightness(1.7) sepia(0.55) saturate(2.4);
  pointer-events: none;
}

.node__face {
  position: absolute;
  inset: 0;
}

/* Рубашка видна только у скрытых карт (рука соперника) и во время переворота. */
.node__face--back {
  display: none;
}

.node--hidden .node__face--back {
  display: block;
}

.node--flipping {
  perspective: 1400px;
}

.node--flipping .node__flip {
  transform-style: preserve-3d;
}

.node--flipping .node__face {
  backface-visibility: hidden;
}

.node--flipping .node__face--back {
  display: block;
  transform: rotateY(180deg);
}

.node__hit {
  position: absolute;
  inset: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  pointer-events: auto;
}

/*
 * Карта руки при наведении поднимается и уезжает из-под курсора. Зона нажатия продлена вниз (за край сцены) на
 * больше, чем высота подъёма, иначе нижняя часть карты «мигала»: курсор выходил за карту, она опускалась, снова
 * входил - и клик по нижнему краю не срабатывал.
 */
.node__hit--liftable {
  bottom: -90px;
}

/*
 * Кнопка карты руки продлена вниз за край карты, поэтому обычная рамка фокуса вышла бы высоким прямоугольником.
 * Вместо неё рамка рисуется вокруг самой карты.
 */
.node__hit:focus-visible {
  outline: none;
}

.node:has(.node__hit:focus-visible) .node__flip {
  outline: 2px solid var(--c-me);
  outline-offset: 4px;
}

.node__hit--inert {
  cursor: default;
}

/*
 * Кнопка утилизации слева внизу: в ряду кораблей и баз соседние карты наползают друг на друга справа налево,
 * и правый нижний угол ближайшей карты перекрыт, а левый край виден всегда.
 */
.node__scrap {
  position: absolute;
  left: 6px;
  bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: rgba(10, 16, 32, 0.92);
  color: var(--c-text-quiet);
  box-shadow: inset 0 0 0 1px rgba(201, 214, 240, 0.5);
  cursor: pointer;
  opacity: 0;
  pointer-events: auto;
  transition: opacity 0.15s;
}

.node:hover .node__scrap,
.node:focus-within .node__scrap {
  opacity: 1;
}

.node__scrap:hover {
  background: rgba(255, 90, 79, 0.2);
  color: var(--c-combat);
  box-shadow: inset 0 0 0 1px var(--c-combat);
}
</style>
