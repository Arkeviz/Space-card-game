<script setup lang="ts">
import type { CardInstance } from '@space/engine'
import { computed } from 'vue'
import GameButton from '@/common/ui/GameButton.vue'
import { cardName, CardThumb } from '@/modules/cards'
import { RECT } from '../../../lib/rects'
import PromptTimer from './PromptTimer.vue'

/*
 * Сброс карты из руки: по требованию соперника (обязательный) или свой, до N карт с добором (необязательный).
 * В отличие от остальных окон, не закрывает всё поле: затемнено всё, кроме руки, потому что карту для сброса
 * игрок выбирает прямо в руке, а здесь только подтверждает выбор.
 */
const props = defineProps<{
  source: CardInstance | null
  /** Выбранная в руке карта. */
  selected: CardInstance | null
  deadline: number | null
  /** Свой необязательный сброс (Recycling Station): можно пропустить, а за каждую сброшенную карту берётся новая. */
  optional?: boolean
  /** Сколько карт ещё можно сбросить. */
  remaining?: number
}>()

const emit = defineEmits<{
  confirm: []
  skip: []
}>()

const handTop = RECT.SELF_HAND.y
const handLeft = RECT.SELF_HAND.x - 2
const handRight = RECT.SELF_HAND.x + RECT.SELF_HAND.w + 2

const title = computed(() => (props.optional ? `Сбросьте до ${props.remaining ?? 1} карт` : 'Сбросьте 1 карту из руки'))
const lead = computed(() => {
  if (props.optional)
    return 'За каждую сброшенную карту вы возьмёте новую. Выберите карту в руке ниже или пропустите шаг.'
  return props.source
    ? `Так сработал «${cardName(props.source.cardId)}» соперника. Выберите карту в руке ниже.`
    : 'Выберите карту в руке ниже.'
})
</script>

<template>
  <div class="discard">
    <div class="dim" :style="{ top: 0, left: 0, width: '1920px', height: `${handTop}px` }" />
    <div class="dim" :style="{ top: `${handTop}px`, left: 0, width: `${handLeft}px`, height: `${1080 - handTop}px` }" />
    <div class="dim" :style="{ top: `${handTop}px`, left: `${handRight}px`, width: `${1920 - handRight}px`, height: `${1080 - handTop}px` }" />

    <section class="bar" :class="{ 'bar--own': optional }" role="dialog" aria-labelledby="discard-title">
      <span class="bar__corner bar__corner--tl" />
      <span class="bar__corner bar__corner--br" />
      <CardThumb v-if="source" :card-id="source.cardId" :scale="0.36" />
      <div class="bar__text">
        <div class="bar__kind">
          СБРОС · {{ optional ? 'ПО ЖЕЛАНИЮ' : 'ОБЯЗАТЕЛЬНО' }}
        </div>
        <h2 id="discard-title" class="bar__title">
          {{ title }}
        </h2>
        <p class="bar__lead">
          {{ lead }}
        </p>
      </div>
      <div class="bar__timer">
        <PromptTimer :deadline="deadline" />
        <div class="bar__fallback">
          {{ optional ? 'потом шаг пропустится' : 'потом сбросится первая карта' }}
        </div>
      </div>
      <GameButton v-if="optional" variant="ghost" :height="56" @click="emit('skip')">
        Пропустить
      </GameButton>
      <GameButton :height="56" :disabled="!selected" @click="emit('confirm')">
        {{ selected ? `Сбросить «${cardName(selected.cardId)}»` : 'Выберите карту' }}
      </GameButton>
    </section>
  </div>
</template>

<style scoped>
.discard {
  position: absolute;
  inset: 0;
  z-index: 500;
  pointer-events: none;
}

.dim {
  position: absolute;
  background: rgba(4, 7, 14, 0.64);
  pointer-events: auto;
}

.bar {
  position: absolute;
  top: 632px;
  left: 958px;
  display: flex;
  align-items: center;
  gap: 22px;
  width: 1040px;
  padding: 14px 16px 14px 14px;
  background: var(--c-surface);
  box-shadow: inset 0 0 0 1px rgba(179, 156, 255, 0.55), 0 24px 60px rgba(0, 0, 0, 0.6);
  transform: translateX(-50%);
  pointer-events: auto;
}

.bar--own {
  box-shadow: inset 0 0 0 1px rgba(79, 216, 255, 0.55), 0 24px 60px rgba(0, 0, 0, 0.6);
}

.bar--own .bar__kind {
  color: var(--c-me);
}

.bar--own .bar__corner--tl {
  border-top-color: var(--c-me);
  border-left-color: var(--c-me);
}

.bar--own .bar__corner--br {
  border-right-color: var(--c-me);
  border-bottom-color: var(--c-me);
}

.bar__corner {
  position: absolute;
  width: 14px;
  height: 14px;
}

.bar__corner--tl {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--c-opponent);
  border-left: 2px solid var(--c-opponent);
}

.bar__corner--br {
  right: -1px;
  bottom: -1px;
  border-right: 2px solid var(--c-opponent);
  border-bottom: 2px solid var(--c-opponent);
}

.bar__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.bar__kind {
  color: var(--c-opponent);
  font: 600 10px/1 var(--font-mono);
  letter-spacing: 0.18em;
}

.bar__title {
  margin: 0;
  font: 700 22px/1.15 var(--font-display);
}

.bar__lead {
  margin: 0;
  color: var(--c-text-soft);
  font: 400 14px/19px var(--font-text);
}

.bar__timer {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0 6px;
}

.bar__fallback {
  max-width: 120px;
  color: var(--c-muted);
  font: 400 11px/14px var(--font-text);
  text-align: center;
}
</style>
