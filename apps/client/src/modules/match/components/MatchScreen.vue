<script setup lang="ts">
/*
 * Экран матча: подложка, панели, поле с картами и окна поверх. Состояние живёт в Pinia (match-store), анимации
 * ведёт AnimationDirector; сам компонент только соединяет их с разметкой и передаёт намерения игрока в команды.
 */
import type { Command } from '@space/engine'
import type { PileId } from '../modules/board'
import type { MatchTransport } from '../store/match-store'
import { COMMAND_TYPE } from '@space/engine'
import { useMediaQuery } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import StageScaler from '@/common/ui/StageScaler.vue'
import { Board, PILE_ID } from '../modules/board'
import { GameOverScreen, HudLayer, itemsFromCards, itemsFromContents, PileViewer } from '../modules/hud'
import { PromptHost } from '../modules/prompts'
import { useMatchStore } from '../store/match-store'

const props = defineProps<{
  transport: MatchTransport
  /** Есть ли связь с сервером (для индикатора «В СЕТИ»). */
  online: boolean
}>()

const emit = defineEmits<{ leave: [] }>()

const store = useMatchStore()
const { table, legalIndex, interactive, busy, speed, log, fx, banner, toast, deadline, timerTotal, selectedCardId } = storeToRefs(store)

const board = useTemplateRef<InstanceType<typeof Board>>('board')

// Ввод и анимации идут в одной сцене; при prefers-reduced-motion переходы сжимаются почти в ноль.
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const layerSpeed = computed(() => speed.value * (reducedMotion.value ? 20 : 1))

store.attach(props.transport, {
  setMotion: motion => board.value?.setMotion(motion),
  snapNext: () => board.value?.snapNext(),
  settled: () => board.value?.settled() ?? Promise.resolve(),
})

onMounted(() => store.start())
onBeforeUnmount(() => store.detach())

const viewedPile = ref<PileId | null>(null)
const hideGameOver = ref(false)

const viewedPileData = computed(() => {
  if (!table.value || !viewedPile.value)
    return null
  switch (viewedPile.value) {
    case PILE_ID.SELF_DECK:
      return {
        title: `ВАША КОЛОДА · ${table.value.self.deckCount}`,
        items: itemsFromContents(table.value.self.deckContents ?? {}),
        note: 'Порядок карт в колоде скрыт: показан только состав, от дешёвых к дорогим.',
      }
    case PILE_ID.SELF_DISCARD:
      return { title: `ВАШ СБРОС · ${table.value.self.discard.length}`, items: itemsFromCards(table.value.self.discard) }
    case PILE_ID.OPPONENT_DISCARD:
      return { title: `СБРОС СОПЕРНИКА · ${table.value.opponent.discard.length}`, items: itemsFromCards(table.value.opponent.discard) }
    case PILE_ID.SCRAP_HEAP:
      return { title: `СВАЛКА · ${table.value.scrapHeap.length}`, items: itemsFromCards(table.value.scrapHeap) }
  }
  return null
})

const gameOver = computed(() => {
  const state = table.value
  if (!state || state.winner === null || busy.value)
    return null
  const win = state.winner === state.you
  const loser = win ? state.opponent : state.self
  return {
    win,
    turn: state.turn,
    conceded: loser.authority > 0,
    self: state.self.authority,
    opponent: state.opponent.authority,
  }
})

const showGameOver = computed(() => gameOver.value !== null && !hideGameOver.value)

watch(() => table.value?.winner, () => {
  hideGameOver.value = false
})

function run(command: Command): void {
  store.submit(command)
}

function attackPlayer(amount: number): void {
  run({ type: COMMAND_TYPE.ATTACK_PLAYER, amount })
}

// Выбор карты для сброса относится к конкретному prompt: новый prompt начинается без выбора.
const pending = computed(() => table.value?.prompt ?? null)
watch(pending, () => {
  selectedCardId.value = null
})
</script>

<template>
  <StageScaler v-if="table">
    <div class="match space-backdrop">
      <div class="match__stars" aria-hidden="true" />

      <HudLayer
        :table="table"
        :legal="legalIndex"
        :interactive="interactive"
        :log="log"
        :deadline="deadline"
        :timer-total="timerTotal"
        :fx="fx"
        :banner="banner"
        :online="online"
        :play-all-count="store.playingAll ? 0 : store.playableCount"
        @attack="attackPlayer"
        @end-turn="run({ type: COMMAND_TYPE.END_TURN })"
        @play-all="store.playAll()"
        @concede="run({ type: COMMAND_TYPE.CONCEDE })"
      />

      <Board
        ref="board"
        :table="table"
        :legal="legalIndex"
        :interactive="interactive"
        :selected-card-id="selectedCardId"
        :speed="layerSpeed"
        @command="run"
        @select="store.select"
        @view-pile="viewedPile = $event"
      />

      <PromptHost
        v-if="!busy && table.winner === null"
        :table="table"
        :legal="legalIndex"
        :deadline="deadline"
        :selected-card-id="selectedCardId"
        @command="run"
      />

      <PileViewer v-if="viewedPileData" :title="viewedPileData.title" :items="viewedPileData.items" :note="viewedPileData.note" @close="viewedPile = null" />

      <GameOverScreen
        v-if="gameOver && showGameOver"
        :win="gameOver.win"
        :turn="gameOver.turn"
        :self-authority="gameOver.self"
        :opponent-authority="gameOver.opponent"
        :conceded="gameOver.conceded"
        @new-match="emit('leave')"
        @view-field="hideGameOver = true"
      />
      <button v-if="gameOver && !showGameOver" type="button" class="match__result" @click="hideGameOver = false">
        {{ gameOver.win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ' }} · ИТОГИ
      </button>

      <div v-if="toast" class="match__toast" role="alert">
        {{ toast }}
      </div>
    </div>
  </StageScaler>
</template>

<style scoped>
.match {
  position: absolute;
  inset: 0;
  overflow: hidden;
  font-family: var(--font-text);
}

.match__stars {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(1.4px 1.4px at 7% 12%, rgba(230, 238, 255, 0.7), rgba(230, 238, 255, 0) 100%),
    radial-gradient(1px 1px at 18% 64%, rgba(230, 238, 255, 0.5), rgba(230, 238, 255, 0) 100%),
    radial-gradient(1.2px 1.2px at 31% 22%, rgba(230, 238, 255, 0.55), rgba(230, 238, 255, 0) 100%),
    radial-gradient(1px 1px at 44% 88%, rgba(230, 238, 255, 0.45), rgba(230, 238, 255, 0) 100%),
    radial-gradient(1.4px 1.4px at 57% 9%, rgba(230, 238, 255, 0.6), rgba(230, 238, 255, 0) 100%),
    radial-gradient(1px 1px at 66% 47%, rgba(230, 238, 255, 0.4), rgba(230, 238, 255, 0) 100%),
    radial-gradient(1.2px 1.2px at 78% 73%, rgba(230, 238, 255, 0.55), rgba(230, 238, 255, 0) 100%),
    radial-gradient(1px 1px at 86% 18%, rgba(230, 238, 255, 0.5), rgba(230, 238, 255, 0) 100%),
    radial-gradient(1.4px 1.4px at 93% 58%, rgba(230, 238, 255, 0.6), rgba(230, 238, 255, 0) 100%),
    radial-gradient(1px 1px at 12% 92%, rgba(230, 238, 255, 0.4), rgba(230, 238, 255, 0) 100%);
}

.match__result {
  position: absolute;
  top: 120px;
  left: 50%;
  z-index: 600;
  height: 44px;
  padding: 0 22px;
  border: 0;
  background: var(--c-surface);
  color: var(--c-me);
  font: 600 12px/1 var(--font-mono);
  letter-spacing: 0.16em;
  box-shadow: inset 0 0 0 1px var(--c-me);
  cursor: pointer;
  transform: translateX(-50%);
}

.match__toast {
  position: absolute;
  bottom: 120px;
  left: 50%;
  z-index: 700;
  padding: 14px 22px;
  background: var(--c-surface);
  color: var(--c-text);
  font: 500 16px/1 var(--font-text);
  box-shadow: inset 0 0 0 1px var(--c-combat), 0 20px 50px rgba(0, 0, 0, 0.6);
  transform: translateX(-50%);
}
</style>
