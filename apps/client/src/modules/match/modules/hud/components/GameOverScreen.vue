<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from 'vue'
import GameButton from '@/common/ui/GameButton.vue'
import { circlePath } from '@/common/ui/icons'

const props = defineProps<{
  win: boolean
  turn: number
  selfAuthority: number
  opponentAuthority: number
  /** Партия кончилась сдачей, а не обнулением авторитета. */
  conceded: boolean
}>()

defineEmits<{
  newMatch: []
  viewField: []
}>()

const title = computed(() => (props.win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'))
const reason = computed(() => {
  if (props.conceded)
    return props.win ? 'Соперник сдался.' : 'Вы сдались.'
  return props.win ? 'Авторитет соперника обнулён.' : 'Ваш авторитет обнулён.'
})

const dialog = useTemplateRef<HTMLElement>('dialog')
onMounted(() => dialog.value?.querySelector<HTMLElement>('button')?.focus())
</script>

<template>
  <div class="over" :class="win ? 'over--win' : 'over--lose'">
    <svg class="over__rings" viewBox="0 0 1920 1080" aria-hidden="true">
      <path :d="circlePath(960, 470, 460)" class="over__ring over__ring--outer" />
      <path :d="circlePath(960, 470, 330)" class="over__ring over__ring--inner" />
    </svg>

    <section ref="dialog" class="over__dialog" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div class="over__meta">
        МАТЧ ЗАВЕРШЁН · ХОД {{ turn }}
      </div>
      <h1 id="result-title" class="over__title">
        {{ title }}
      </h1>
      <p class="over__reason">
        {{ reason }}
      </p>

      <div class="over__stats">
        <div class="stat" :class="{ 'stat--winner': win }">
          <div class="stat__label">
            ВЫ · АВТОРИТЕТ
          </div>
          <div class="stat__value">
            {{ selfAuthority }}
          </div>
        </div>
        <div class="stat" :class="{ 'stat--winner': !win }">
          <div class="stat__label">
            СОПЕРНИК · АВТОРИТЕТ
          </div>
          <div class="stat__value">
            {{ opponentAuthority }}
          </div>
        </div>
      </div>

      <div class="over__actions">
        <GameButton class="over__button" @click="$emit('newMatch')">
          Новый матч
        </GameButton>
        <GameButton class="over__button" variant="ghost" @click="$emit('viewField')">
          Посмотреть поле
        </GameButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
.over {
  position: absolute;
  inset: 0;
  z-index: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(4, 7, 14, 0.5);
  backdrop-filter: blur(7px) brightness(0.5);
  --tone: var(--c-me);
  --tone-glow: rgba(79, 216, 255, 0.45);
}

.over--lose {
  --tone: var(--c-opponent);
  --tone-glow: rgba(179, 156, 255, 0.45);
}

.over__rings {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.over__ring {
  fill: none;
  stroke: var(--tone);
}

.over__ring--outer {
  opacity: 0.12;
}

.over__ring--inner {
  opacity: 0.22;
}

.over__dialog {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 26px;
  align-items: center;
  width: 1100px;
  text-align: center;
}

.over__meta {
  color: var(--c-muted);
  font: 600 12px/1 var(--font-mono);
  letter-spacing: 0.26em;
}

.over__title {
  margin: 0;
  color: var(--tone);
  font: 800 128px/0.95 var(--font-display);
  letter-spacing: -0.01em;
  text-shadow: 0 0 60px var(--tone-glow);
}

.over__reason {
  margin: 0;
  color: var(--c-text-quiet);
  font: 400 22px/30px var(--font-text);
}

.over__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  width: 560px;
  margin-top: 8px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  padding: 20px 0 22px;
  background: rgba(10, 16, 32, 0.88);
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.22);
}

.stat--winner {
  box-shadow: inset 0 0 0 1px var(--tone);
}

.stat__label {
  color: var(--c-muted);
  font: 600 11px/1 var(--font-mono);
  letter-spacing: 0.18em;
}

.stat__value {
  color: var(--c-text-strong);
  font: 800 56px/1 var(--font-display);
}

.over__actions {
  display: flex;
  gap: 14px;
  margin-top: 12px;
}

.over__button {
  width: 260px;
}
</style>
