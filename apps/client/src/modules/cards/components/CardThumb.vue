<script setup lang="ts">
import type { CardForm, CardVisualState } from '../lib/card-visual'
import { computed } from 'vue'
import { CARD_FORM, CARD_SIZE, CARD_STATE } from '../lib/card-visual'
import CardView from './CardView.vue'

/** Уменьшенная карта для окон выбора и списков: занимает в вёрстке ровно столько места, сколько видно. */
const props = withDefaults(defineProps<{
  cardId: string | null
  scale: number
  form?: CardForm
  state?: CardVisualState
}>(), {
  form: CARD_FORM.CARD,
  state: CARD_STATE.IDLE,
})

const size = computed(() => (props.form === CARD_FORM.DEPLOYED ? CARD_SIZE.DEPLOYED : CARD_SIZE.CARD))
const boxStyle = computed(() => ({ width: `${size.value.w * props.scale}px`, height: `${size.value.h * props.scale}px` }))
const innerStyle = computed(() => ({ transform: `scale(${props.scale})` }))
</script>

<template>
  <div class="thumb" :style="boxStyle">
    <div class="thumb__inner" :style="innerStyle">
      <CardView :card-id="cardId" :form="form" :state="state" />
    </div>
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
</style>
