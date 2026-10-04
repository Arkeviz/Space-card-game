<script setup lang="ts">
import type { CardNode } from '../lib/nodes'
import { computed } from 'vue'
import AppIcon from '@/common/ui/AppIcon.vue'
import { ICON } from '@/common/ui/icons'
import { CARD_FORM, CARD_SIZE, cardName, CardView } from '@/modules/cards'

/*
 * Одна карта на столе: невидимая кнопка сверху (клик, фокус, подпись для скринридера), под ней двусторонняя
 * карта, которую можно перевернуть через rotationY (CSS 3D). Позицию и поворот всей карты задаёт CardLayer.
 */
const props = defineProps<{ node: CardNode }>()

const emit = defineEmits<{
  click: [node: CardNode]
  highlight: [key: string | null]
  scrap: [node: CardNode]
}>()

const size = computed(() => (props.node.form === CARD_FORM.DEPLOYED ? CARD_SIZE.DEPLOYED : CARD_SIZE.CARD))
const style = computed(() => ({ width: `${size.value.w}px`, height: `${size.value.h}px` }))
const scrapLabel = computed(() => (props.node.cardId ? `Утилизировать «${cardName(props.node.cardId)}»` : ''))
</script>

<template>
  <div class="node" :class="{ 'node--hidden': !node.cardId }" :data-key="node.key" :style="style">
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
        />
      </div>
    </div>

    <button
      v-if="node.click"
      type="button"
      class="node__hit"
      :class="{ 'node__hit--liftable': node.liftable }"
      :aria-label="node.label"
      @click="emit('click', node)"
      @pointerenter="emit('highlight', node.key)"
      @pointerleave="emit('highlight', null)"
      @focus="emit('highlight', node.key)"
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

.node__hit--inert {
  cursor: default;
}

.node__scrap {
  position: absolute;
  right: 6px;
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
