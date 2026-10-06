<script setup lang="ts">
import type { FxItem } from '../lib/fx'
import { computed } from 'vue'
import { useTick } from '@/common/composables/useTick'
import AppIcon from '@/common/ui/AppIcon.vue'
import { ICON } from '@/common/ui/icons'
import { formatClock } from '@/common/utilities/clock'
import FxFloat from './FxFloat.vue'

const props = defineProps<{
  /** Имя соперника. */
  name: string
  authority: number
  handCount: number
  /** Сейчас ход соперника. */
  active: boolean
  /** У соперника есть аванпост: игрока атаковать нельзя. */
  protectedByOutpost: boolean
  /** Сколько можно нанести игроку (0 - атаковать нельзя). */
  attackAmount: number
  /** Соперник на связи. */
  online: boolean
  /** Момент (Date.now()), когда отключившемуся сопернику засчитают сдачу; null, пока он на связи. */
  returnDeadline: number | null
  fx: FxItem[]
}>()

defineEmits<{ attack: [] }>()

const now = useTick()
const returnClock = computed(() => {
  if (props.returnDeadline === null)
    return ''
  return formatClock(Math.max(0, props.returnDeadline - now.value.getTime()))
})
</script>

<template>
  <section class="panel" :class="{ 'panel--active': active }" :aria-label="`Соперник: ${name}`">
    <span class="panel__corner" />
    <!-- Атаковать соперника можно кликом по аватару: это та же команда, что и кнопка «Атаковать» в панели хода. -->
    <button
      type="button"
      class="panel__avatar"
      :class="{ 'panel__avatar--target': attackAmount > 0 }"
      :disabled="attackAmount === 0"
      :aria-label="attackAmount > 0 ? `Атаковать соперника ${name}: ${attackAmount}` : `Соперник: ${name}`"
      @click="$emit('attack')"
    >
      <AppIcon :name="attackAmount > 0 ? ICON.COMBAT : ICON.USER" :size="26" :stroke="attackAmount > 0 ? 2 : 1.5" />
    </button>
    <div class="panel__info">
      <p class="panel__name" :title="name">
        <span class="panel__dot" :class="{ 'panel__dot--offline': !online }" aria-hidden="true" />
        <span>{{ name }}</span>
        <span class="visually-hidden">{{ online ? ', на связи' : ', нет связи' }}</span>
      </p>
      <p class="panel__sub">
        РУКА {{ handCount }}
      </p>
    </div>
    <div class="panel__authority">
      <div class="panel__value">
        {{ authority }}
        <FxFloat :items="fx" />
      </div>
      <p class="panel__label">
        <AppIcon :name="ICON.AUTHORITY" :size="11" :stroke="2.4" />
        <span>АВТОРИТЕТ</span>
      </p>
    </div>

    <p v-if="!online" class="panel__offline" role="status">
      <AppIcon :name="ICON.CLOCK" :size="12" />
      <span>НЕТ СВЯЗИ<template v-if="returnDeadline !== null"> · СДАЧА ЧЕРЕЗ {{ returnClock }}</template></span>
    </p>
    <p v-if="protectedByOutpost" class="panel__badge">
      <AppIcon :name="ICON.LOCK" :size="12" />
      <span>ЗАЩИЩЁН АВАНПОСТОМ</span>
    </p>
  </section>
</template>

<style scoped>
.panel {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 100%;
  padding: 0 14px;
  background: rgba(10, 16, 32, 0.92);
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.25);
  transition: box-shadow 0.3s;
}

.panel--active {
  box-shadow: inset 0 0 0 1px rgba(179, 156, 255, 0.55), 0 0 22px rgba(179, 156, 255, 0.18);
}

.panel__corner {
  position: absolute;
  top: -1px;
  left: -1px;
  width: 12px;
  height: 12px;
  border-top: 2px solid var(--c-opponent);
  border-left: 2px solid var(--c-opponent);
}

.panel__avatar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  padding: 0;
  border: 0;
  cursor: default;
  background: repeating-linear-gradient(135deg, rgba(179, 156, 255, 0.14) 0 6px, rgba(179, 156, 255, 0.04) 6px 12px);
  color: var(--c-opponent);
  box-shadow: inset 0 0 0 1px rgba(179, 156, 255, 0.5);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}

.panel__info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.panel__dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 7px;
  border-radius: 50%;
  background: var(--c-authority);
  vertical-align: 1px;
}

.panel__dot--offline {
  background: var(--c-combat);
}

.panel__offline {
  position: absolute;
  top: -12px;
  left: 14px;
  z-index: 3;
  display: flex;
  gap: 6px;
  align-items: center;
  height: 22px;
  padding: 0 9px 0 7px;
  background: #2a1214;
  color: #ff8c84;
  font: 600 10px/1 var(--font-mono);
  letter-spacing: 0.1em;
  white-space: nowrap;
  box-shadow: inset 0 0 0 1px rgba(255, 90, 79, 0.6);
}

.panel__name {
  overflow: hidden;
  font: 600 15px/1.2 var(--font-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel__sub {
  color: var(--c-muted);
  font: 500 10px/1 var(--font-mono);
  letter-spacing: 0.1em;
}

.panel__authority {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
}

.panel__value {
  position: relative;
  color: var(--c-text-strong);
  font: 800 34px/1 var(--font-display);
}

.panel__label {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #8fe8c4;
  font: 600 9px/1 var(--font-mono);
  letter-spacing: 0.14em;
}

.panel__badge {
  position: absolute;
  bottom: -12px;
  left: 14px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 9px 0 7px;
  border: 0;
  background: #121b30;
  color: var(--c-text-quiet);
  font: 600 9px/1 var(--font-mono);
  letter-spacing: 0.12em;
  white-space: nowrap;
  box-shadow: inset 0 0 0 1px rgba(169, 182, 207, 0.45);
}

/* Когда соперника можно атаковать, аватар краснеет и пульсирует: это кнопка. */
.panel__avatar--target {
  background: rgba(255, 90, 79, 0.16);
  color: var(--c-combat);
  box-shadow: inset 0 0 0 1px var(--c-combat), 0 0 16px rgba(255, 90, 79, 0.35);
  cursor: pointer;
  animation: avatar-pulse 1.6s ease-in-out infinite;
}

.panel__avatar--target:hover {
  background: rgba(255, 90, 79, 0.3);
}

@keyframes avatar-pulse {
  50% {
    box-shadow: inset 0 0 0 1px var(--c-combat), 0 0 26px rgba(255, 90, 79, 0.65);
  }
}

@media (prefers-reduced-motion: reduce) {
  .panel__avatar--target {
    animation: none;
  }
}
</style>
