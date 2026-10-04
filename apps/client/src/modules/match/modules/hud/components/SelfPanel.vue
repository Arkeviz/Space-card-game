<script setup lang="ts">
import type { FxItem } from '../lib/fx'
import AppIcon from '@/common/ui/AppIcon.vue'
import { ICON } from '@/common/ui/icons'
import FxFloat from './FxFloat.vue'

defineProps<{
  authority: number
  /** Сейчас ваш ход. */
  active: boolean
  online: boolean
  fx: FxItem[]
}>()
</script>

<template>
  <section class="panel" :class="{ 'panel--active': active }" aria-label="Вы">
    <span class="panel__corner panel__corner--tl" />
    <span class="panel__corner panel__corner--br" />
    <div class="panel__who">
      <div class="panel__avatar">
        <AppIcon :name="ICON.USER" :size="30" :stroke="1.5" />
      </div>
      <div class="panel__info">
        <div class="panel__name">
          Вы
        </div>
        <div class="panel__status" :class="{ 'panel__status--offline': !online }">
          <span class="panel__dot" />
          <span>{{ online ? 'В СЕТИ' : 'НЕТ СВЯЗИ' }}</span>
        </div>
      </div>
    </div>
    <div class="panel__authority">
      <div class="panel__label">
        <AppIcon :name="ICON.AUTHORITY" :size="13" :stroke="2.4" />
        <span>АВТОРИТЕТ</span>
      </div>
      <div class="panel__value">
        {{ authority }}
        <FxFloat :items="fx" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 14px;
  width: 100%;
  height: 100%;
  padding: 16px 18px 18px;
  background: rgba(10, 16, 32, 0.92);
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.25);
  transition: box-shadow 0.3s;
}

.panel--active {
  box-shadow: inset 0 0 0 1px rgba(79, 216, 255, 0.55), 0 0 22px rgba(79, 216, 255, 0.16);
}

.panel__corner {
  position: absolute;
  width: 12px;
  height: 12px;
}

.panel__corner--tl {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--c-me);
  border-left: 2px solid var(--c-me);
}

.panel__corner--br {
  right: -1px;
  bottom: -1px;
  border-right: 2px solid var(--c-me);
  border-bottom: 2px solid var(--c-me);
}

.panel__who {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel__avatar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: repeating-linear-gradient(135deg, rgba(79, 216, 255, 0.14) 0 6px, rgba(79, 216, 255, 0.04) 6px 12px);
  color: var(--c-me);
  box-shadow: inset 0 0 0 1px rgba(79, 216, 255, 0.55);
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
}

.panel__info {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.panel__name {
  font: 600 17px/1 var(--font-text);
}

.panel__status {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--c-muted);
  font: 500 10px/1 var(--font-mono);
  letter-spacing: 0.1em;
}

.panel__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c-authority);
}

.panel__status--offline .panel__dot {
  background: var(--c-combat);
}

.panel__authority {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel__label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #8fe8c4;
  font: 600 10px/1 var(--font-mono);
  letter-spacing: 0.16em;
}

.panel__value {
  position: relative;
  width: fit-content;
  color: var(--c-text-strong);
  font: 800 72px/0.9 var(--font-display);
}

.panel__value :deep(.fx) {
  top: -6px;
  right: -24px;
  font-size: 34px;
}
</style>
