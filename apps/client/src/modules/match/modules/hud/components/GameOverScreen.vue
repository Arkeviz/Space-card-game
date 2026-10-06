<script setup lang="ts">
import type { EndReason } from '@space/protocol'
import type { RematchStatus } from '../lib/game-over'
import { computed, onMounted, useTemplateRef } from 'vue'
import { useStageDim } from '@/common/composables/useStageDim'
import GameButton from '@/common/ui/GameButton.vue'
import { circlePath } from '@/common/ui/icons'
import { STAGE_DIM } from '@/common/ui/stage-dim'
import { rematchView, resultReason } from '../lib/game-over'

const props = defineProps<{
  win: boolean
  turn: number
  /** Почему партия закончилась; null - причина неизвестна. */
  reason: EndReason | null
  selfName: string
  opponentName: string
  rematch: RematchStatus
}>()

defineEmits<{
  mainMenu: []
  viewField: []
  rematch: []
}>()

// Экран итогов затемняет сцену, а поля вокруг неё затемняет StageScaler.
useStageDim(STAGE_DIM.RESULT)

const title = computed(() => (props.win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'))
const reasonText = computed(() => resultReason(props.win, props.reason))
const rematchButton = computed(() => rematchView(props.rematch))

const dialog = useTemplateRef<HTMLElement>('dialog')
onMounted(() => dialog.value?.querySelector<HTMLElement>('button:not(:disabled)')?.focus())
</script>

<template>
  <div class="over" :class="win ? 'over--win' : 'over--lose'">
    <svg class="over__rings" viewBox="0 0 1920 1080" aria-hidden="true">
      <path :d="circlePath(960, 470, 460)" class="over__ring over__ring--outer" />
      <path :d="circlePath(960, 470, 330)" class="over__ring over__ring--inner" />
    </svg>

    <section ref="dialog" class="over__dialog" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <p class="over__meta">
        МАТЧ ЗАВЕРШЁН · ХОД {{ turn }}
      </p>
      <h1 id="result-title" class="over__title">
        {{ title }}
      </h1>
      <p class="over__reason">
        {{ reasonText }}
      </p>
      <p class="over__players">
        <span class="over__player">{{ selfName }}</span>
        <span class="over__vs">VS</span>
        <span class="over__player">{{ opponentName }}</span>
      </p>

      <div class="over__actions">
        <GameButton class="over__button" :disabled="rematchButton.disabled" @click="$emit('rematch')">
          {{ rematchButton.label }}
        </GameButton>
        <GameButton class="over__button" variant="outline" @click="$emit('mainMenu')">
          В главное меню
        </GameButton>
        <GameButton class="over__button" variant="ghost" @click="$emit('viewField')">
          Посмотреть поле
        </GameButton>
      </div>
      <p class="over__note" role="status">
        {{ rematchButton.note }}
      </p>
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
  font: 600 14px/1 var(--font-mono);
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

.over__players {
  display: flex;
  gap: 16px;
  align-items: baseline;
  max-width: 100%;
  color: var(--c-text-soft);
  font: 600 20px/1.2 var(--font-text);
}

.over__player {
  overflow: hidden;
  max-width: 340px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.over__vs {
  color: var(--c-muted);
  font: 600 12px/1 var(--font-mono);
  letter-spacing: 0.2em;
}

.over__actions {
  display: flex;
  gap: 14px;
  margin-top: 14px;
}

.over__button {
  width: 260px;
}

/* Место под пояснение занято всегда: кнопки не прыгают, когда оно появляется. */
.over__note {
  min-height: 20px;
  margin: 0;
  color: var(--c-muted);
  font: 500 15px/20px var(--font-text);
}
</style>
