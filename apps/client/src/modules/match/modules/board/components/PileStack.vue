<script setup lang="ts">
/*
 * Стопка карт (колода или сброс): подложка из двух смещённых теней, счётчик и подпись. Сами карты стопки
 * (верх сброса) рисует CardLayer; здесь - только то, что остаётся, когда карт нет, и общая рамка.
 */
import { computed } from 'vue'
import { CARD_FORM, CardView } from '@/modules/cards'

const props = withDefaults(defineProps<{
  x: number
  y: number
  scale: number
  count: number
  label: string
  /** Рисовать рубашку (колода) или пустую рамку «ПУСТО» (сброс без карт). */
  back?: boolean
  /** Цвет подложки: cyan - колоды, steel - сбросы. */
  tone?: 'cyan' | 'steel'
  /** Компактный вариант (колода и сброс соперника): подпись и число справа от карты. */
  compact?: boolean
  /** Счётчик под картой (у пачки исследователей число уже в подписи). */
  showBadge?: boolean
  ariaLabel?: string
}>(), {
  back: false,
  tone: 'cyan',
  compact: false,
  showBadge: true,
  ariaLabel: undefined,
})

const WIDTH = 200
const HEIGHT = 280

const boxStyle = computed(() => ({
  left: `${props.x - (WIDTH * props.scale) / 2}px`,
  top: `${props.y - (HEIGHT * props.scale) / 2}px`,
  width: `${WIDTH * props.scale}px`,
  height: `${HEIGHT * props.scale}px`,
}))
const innerStyle = computed(() => ({ transform: `scale(${props.scale})` }))
const bevel = computed(() => `${Math.round(16 * props.scale)}px`)
</script>

<template>
  <div class="pile" :class="[`pile--${tone}`, { 'pile--compact': compact }]" :style="boxStyle" role="group" :aria-label="ariaLabel ?? `${label}: ${count}`">
    <template v-if="!compact && count > 0">
      <div class="pile__shade pile__shade--far" :style="{ '--bevel': bevel }" />
      <div class="pile__shade pile__shade--near" :style="{ '--bevel': bevel }" />
    </template>
    <div v-if="back && count > 0" class="pile__card" :style="innerStyle">
      <CardView :form="CARD_FORM.BACK" />
    </div>
    <div v-else-if="count === 0" class="pile__empty">
      ПУСТО
    </div>
    <div v-if="!compact && showBadge" class="pile__badge">
      {{ count }}
    </div>
    <div class="pile__caption" :class="{ 'pile__caption--compact': compact }">
      <span class="pile__label">{{ label }}</span>
      <span v-if="compact" class="pile__count">{{ count }}</span>
    </div>
  </div>
</template>

<style scoped>
.pile {
  position: absolute;
  pointer-events: none;
  transition: top 0.55s;
}

.pile__shade {
  position: absolute;
  inset: 0;
  clip-path: polygon(var(--bevel) 0, 100% 0, 100% calc(100% - var(--bevel)), calc(100% - var(--bevel)) 100%, 0 100%, 0 var(--bevel));
}

.pile--cyan .pile__shade--far {
  background: rgba(79, 216, 255, 0.14);
  transform: translate(6px, -6px);
}

.pile--cyan .pile__shade--near {
  background: rgba(79, 216, 255, 0.26);
  transform: translate(3px, -3px);
}

.pile--steel .pile__shade--far {
  background: rgba(169, 182, 207, 0.12);
  transform: translate(6px, -6px);
}

.pile--steel .pile__shade--near {
  background: rgba(169, 182, 207, 0.2);
  transform: translate(3px, -3px);
}

.pile__card {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

.pile__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(143, 163, 200, 0.4);
  color: var(--c-dim);
  font: 600 9px/1 var(--font-mono);
  letter-spacing: 0.16em;
}

/* Выше карт слоя (их z-index не больше 50 в покое), чтобы счётчик не пропадал под верхней картой стопки. */
.pile__badge {
  position: absolute;
  z-index: 100;
  bottom: -10px;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 24px;
  padding: 0 8px;
  background: var(--c-surface-raised);
  color: var(--c-text);
  font: 700 13px/1 var(--font-display);
  box-shadow: inset 0 0 0 1px rgba(79, 216, 255, 0.5);
  transform: translateX(-50%);
}

.pile--steel .pile__badge {
  box-shadow: inset 0 0 0 1px rgba(169, 182, 207, 0.5);
}

.pile__caption {
  position: absolute;
  z-index: 100;
  top: calc(100% + 14px);
  left: 50%;
  color: var(--c-muted);
  font: 600 10px/1 var(--font-mono);
  letter-spacing: 0.14em;
  white-space: nowrap;
  transform: translateX(-50%);
}

.pile__caption--compact {
  top: 50%;
  left: calc(100% + 8px);
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 8px;
  letter-spacing: 0.12em;
  transform: translateY(-50%);
}

.pile__count {
  color: var(--c-text);
  font: 700 18px/1 var(--font-display);
  letter-spacing: 0;
}
</style>
