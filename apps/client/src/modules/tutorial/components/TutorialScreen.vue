<script setup lang="ts">
/*
 * Экран обучения: обычный экран матча, которому вместо сервера подключена учебная сессия (TutorialSession),
 * и поверх него - окно тура. Сессия сама следит, чтобы игрок делал именно то, что описывает подсказка.
 */
import type { TourStep } from '@/common/ui/tour'
import { until } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, shallowRef, useTemplateRef } from 'vue'
import AppDialog from '@/common/ui/AppDialog.vue'
import AppTour from '@/common/ui/AppTour.vue'
import GameButton from '@/common/ui/GameButton.vue'
import { MatchScreen } from '@/modules/match'
import { createLessonGame } from '../lib/lesson-game'
import { LESSON_STEPS } from '../lib/lesson-steps'
import { STEP_KIND } from '../lib/lesson-types'
import { TutorialSession } from '../lib/session'

defineProps<{
  /** Имя игрока на его панели. */
  playerName: string
}>()

const emit = defineEmits<{
  /** Игрок вышел из обучения или дошёл до конца. */
  leave: []
}>()

const OPPONENT_NAME = 'Инструктор'
const NO_REMATCH = { you: false, opponent: false, available: false }

const match = useTemplateRef<InstanceType<typeof MatchScreen>>('match')

const session = new TutorialSession(createLessonGame(), LESSON_STEPS, {
  // Ходы соперника ждут, пока экран матча доиграл предыдущие анимации.
  whenIdle: () => until(() => match.value?.busy ?? false).toBe(false),
})
const resolved = shallowRef(session.resolve())
const stopWatching = session.onStepChange(() => {
  resolved.value = session.resolve()
})
onBeforeUnmount(() => {
  stopWatching()
  session.dispose()
})

const step = computed<TourStep>(() => ({
  id: resolved.value.id,
  title: resolved.value.title,
  description: resolved.value.description,
  target: resolved.value.target,
  side: resolved.value.side,
}))

const exitOpen = ref(false)

/*
 * Подсказка видна, когда стол спокоен: пока идёт анимация (в том числе раздача карт в начале), она бы указывала
 * на летящие карты. Исключение - шаги с ходом соперника: они объясняют как раз то, что сейчас анимируется.
 * Поверх окон (настройки, справка, выход) подсказка не показывается.
 */
const open = computed(() => {
  if (exitOpen.value || match.value?.dialogOpen)
    return false
  return resolved.value.kind === STEP_KIND.AUTO || !match.value?.busy
})

function onNext(): void {
  if (!session.next())
    emit('leave')
}
</script>

<template>
  <MatchScreen
    ref="match"
    :transport="session.transport"
    :online="true"
    :opponent-online="true"
    :opponent-return-deadline="null"
    :names="{ self: playerName, opponent: OPPONENT_NAME }"
    :end-reason="null"
    :rematch="NO_REMATCH"
    tutorial
    @leave="emit('leave')"
  >
    <AppTour
      :open="open"
      :step="step"
      :current="resolved.number"
      :total="resolved.total"
      :show-prev="resolved.canPrev"
      :show-next="resolved.canNext"
      :next-label="resolved.nextLabel"
      closable
      @prev="session.prev()"
      @next="onNext"
      @close="exitOpen = true"
    />

    <AppDialog v-if="exitOpen" title="Выйти из обучения?" :width="620" closable @close="exitOpen = false">
      <p class="exit__text">
        Учебная партия закроется, а при следующем входе начнётся сначала.
      </p>
      <template #footer>
        <GameButton :height="48" @click="exitOpen = false">
          Остаться
        </GameButton>
        <GameButton variant="danger" :height="48" @click="emit('leave')">
          Выйти
        </GameButton>
      </template>
    </AppDialog>
  </MatchScreen>
</template>

<style scoped>
.exit__text {
  color: var(--c-text-soft);
  font: 400 19px/28px var(--font-text);
}
</style>
