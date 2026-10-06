<script setup lang="ts">
import type { Pools } from '@space/engine'
import type { FxItem } from '../lib/fx'
import type { Hint, TurnInfo } from '../lib/turn-info'
import { computed } from 'vue'
import { useTick } from '@/common/composables/useTick'
import AppIcon from '@/common/ui/AppIcon.vue'
import { ICON } from '@/common/ui/icons'
import { formatClock } from '@/common/utilities/clock'
import { FX_TARGET } from '../lib/fx'
import FxFloat from './FxFloat.vue'

const props = defineProps<{
  turn: number
  info: TurnInfo
  hint: Hint
  pools: Pools
  /** Момент (Date.now()), когда сервер сам совершит действие за игрока; null - таймера нет. */
  deadline: number | null
  /** Полная длительность таймера, мс: нужна для полоски. */
  timerTotal: number
  /** Можно ли завершить ход прямо сейчас. */
  canEndTurn: boolean
  /** Сколько карт руки можно сыграть кнопкой «разыграть все». */
  playAllCount: number
  /** Сколько атаки можно нанести игроку (0 - атаковать нельзя: нет атаки, прикрывает аванпост или ввод закрыт). */
  attackAmount: number
  fx: FxItem[]
}>()

defineEmits<{
  endTurn: []
  playAll: []
  attack: []
}>()

const now = useTick()
const remaining = computed(() => (props.deadline === null ? null : Math.max(0, props.deadline - now.value.getTime())))
const clock = computed(() => (remaining.value === null ? '' : formatClock(remaining.value)))
const percent = computed(() => (remaining.value === null || props.timerTotal <= 0 ? 0 : Math.min(100, (remaining.value / props.timerTotal) * 100)))
const urgent = computed(() => remaining.value !== null && remaining.value <= 15_000)

const accent = computed(() => (props.info.mine ? 'var(--c-me)' : 'var(--c-opponent)'))
const poolsTitle = computed(() => (props.info.mine ? 'ВАШ ПУЛ' : 'ПУЛ СОПЕРНИКА'))

const tradeFx = computed(() => props.fx.filter(item => item.target === FX_TARGET.TRADE))
const combatFx = computed(() => props.fx.filter(item => item.target === FX_TARGET.COMBAT))
</script>

<template>
  <aside class="turn" aria-label="Ход">
    <div class="turn__card" :class="{ 'turn__card--opponent': !info.mine }" :style="{ '--accent': accent }">
      <span class="turn__corner turn__corner--tl" />
      <span class="turn__corner turn__corner--br" />
      <p class="turn__meta">
        <span>ХОД {{ turn }}</span>
        <span v-if="remaining !== null" class="turn__clock" :class="{ 'turn__clock--urgent': urgent }">
          <AppIcon :name="ICON.CLOCK" :size="13" />
          <span>{{ clock }}</span>
        </span>
      </p>
      <p class="turn__title">
        {{ info.title }}
      </p>
      <p v-if="info.sub" class="turn__sub" role="status">
        {{ info.sub }}
      </p>
      <div class="turn__bar">
        <div class="turn__bar-fill" :style="{ width: `${percent}%` }" />
      </div>
    </div>

    <div class="pools">
      <p class="pools__title">
        {{ poolsTitle }}
      </p>
      <div class="pool pool--trade">
        <AppIcon :name="ICON.TRADE" :size="24" :stroke="1.9" />
        <span class="pool__name">ТОРГОВЛЯ</span>
        <span class="pool__value">
          {{ pools.trade }}
          <FxFloat :items="tradeFx" />
        </span>
      </div>
      <div class="pool pool--combat">
        <AppIcon :name="ICON.COMBAT" :size="24" :stroke="1.9" />
        <span class="pool__name">АТАКА</span>
        <span class="pool__value">
          {{ pools.combat }}
          <FxFloat :items="combatFx" />
        </span>
      </div>
    </div>

    <p class="hint">
      <AppIcon :name="hint.icon" :size="16" :style="{ color: hint.color }" />
      <span>{{ hint.text }}</span>
    </p>

    <button v-if="info.mine" type="button" class="play-all" aria-keyshortcuts="P" :disabled="playAllCount === 0" @click="$emit('playAll')">
      <span>РАЗЫГРАТЬ ВСЕ<template v-if="playAllCount > 0"> · {{ playAllCount }}</template></span>
      <kbd class="key" aria-hidden="true">P</kbd>
    </button>

    <!-- Кнопка остаётся на месте и после разрушения базы: без атаки она просто неактивна. -->
    <button v-if="info.mine" type="button" class="attack" aria-keyshortcuts="A" :disabled="attackAmount === 0" @click="$emit('attack')">
      <AppIcon :name="ICON.COMBAT" :size="16" :stroke="2.2" />
      <span>АТАКОВАТЬ<template v-if="attackAmount > 0"> · {{ attackAmount }}</template></span>
      <kbd class="key" aria-hidden="true">A</kbd>
    </button>

    <button type="button" class="end" aria-keyshortcuts="E" :disabled="!canEndTurn" @click="$emit('endTurn')">
      <span>{{ info.mine ? 'КОНЕЦ ХОДА' : 'ХОД СОПЕРНИКА' }}</span>
      <kbd v-if="info.mine" class="key key--end" aria-hidden="true">E</kbd>
    </button>
  </aside>
</template>

<style scoped>
.turn {
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.turn__card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: rgba(10, 16, 32, 0.92);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 50%, transparent);
}

.turn__corner {
  position: absolute;
  width: 12px;
  height: 12px;
}

.turn__corner--tl {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--accent);
  border-left: 2px solid var(--accent);
}

.turn__corner--br {
  right: -1px;
  bottom: -1px;
  border-right: 2px solid var(--accent);
  border-bottom: 2px solid var(--accent);
}

.turn__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--c-muted);
  font: 600 10px/1 var(--font-mono);
  letter-spacing: 0.16em;
}

.turn__clock {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--c-text-quiet);
  font-variant-numeric: tabular-nums;
}

.turn__clock--urgent {
  color: var(--c-combat);
}

.turn__title {
  color: var(--accent);
  font: 700 22px/1.1 var(--font-display);
  letter-spacing: 0.02em;
}

.turn__sub {
  color: var(--c-text-soft);
  font: 400 13px/17px var(--font-text);
}

.turn__bar {
  height: 4px;
  background: rgba(143, 163, 200, 0.16);
}

.turn__bar-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.25s linear;
}

.pools {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px 16px;
  background: rgba(10, 16, 32, 0.92);
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.18);
}

.pools__title {
  color: var(--c-muted);
  font: 600 10px/1 var(--font-mono);
  letter-spacing: 0.16em;
}

.pool {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 58px;
  padding: 0 14px;
}

.pool--trade {
  background: rgba(255, 194, 61, 0.08);
  color: var(--c-trade);
  box-shadow: inset 0 0 0 1px rgba(255, 194, 61, 0.38);
}

.pool--combat {
  background: rgba(255, 90, 79, 0.08);
  color: var(--c-combat);
  box-shadow: inset 0 0 0 1px rgba(255, 90, 79, 0.4);
}

.pool__name {
  flex: 1;
  font: 600 11px/1 var(--font-mono);
  letter-spacing: 0.14em;
}

.pool--trade .pool__name {
  color: #ebd9a6;
}

.pool--combat .pool__name {
  color: #f2b7b1;
}

.pool__value {
  position: relative;
  font: 800 30px/1 var(--font-display);
  font-variant-numeric: tabular-nums;
}

.hint {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 0 2px;
  color: var(--c-text-quiet);
  font: 400 13px/17px var(--font-text);
}

.hint :deep(svg) {
  margin-top: 1px;
}

/* Подсказка горячей клавиши в углу кнопки. */
.key {
  position: absolute;
  top: 50%;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  color: var(--c-muted);
  font: 600 12px/1 var(--font-mono);
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.4);
  transform: translateY(-50%);
}

.key--end {
  color: var(--c-me-ink);
  box-shadow: inset 0 0 0 1px rgba(4, 19, 26, 0.5);
}

.play-all {
  position: relative;
  height: 44px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--c-me);
  box-shadow: inset 0 0 0 1px var(--c-me);
  font: 600 13px/1 var(--font-mono);
  letter-spacing: 0.14em;
  cursor: pointer;
}

.play-all:hover:not(:disabled) {
  background: rgba(79, 216, 255, 0.1);
}

.play-all:disabled {
  color: var(--c-dim);
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.25);
  cursor: default;
}

.attack {
  position: relative;
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  height: 44px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--c-combat);
  box-shadow: inset 0 0 0 1px var(--c-combat);
  font: 600 13px/1 var(--font-mono);
  letter-spacing: 0.14em;
  cursor: pointer;
}

.attack:hover:not(:disabled) {
  background: rgba(255, 90, 79, 0.12);
}

.attack:disabled {
  color: var(--c-dim);
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.25);
  cursor: default;
}

.end {
  position: relative;
  height: 64px;
  margin: 0;
  padding: 0;
  border: 0;
  background: var(--c-me);
  color: var(--c-me-ink);
  box-shadow: 0 0 24px rgba(79, 216, 255, 0.35);
  font: 700 15px/1 var(--font-display);
  letter-spacing: 0.06em;
  cursor: pointer;
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
}

.end:hover:not(:disabled) {
  filter: brightness(1.1);
}

.end:disabled {
  background: rgba(143, 163, 200, 0.08);
  color: var(--c-dim);
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.25);
  cursor: default;
}
</style>
