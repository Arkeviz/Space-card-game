<script setup lang="ts">
/*
 * Экран матча: подложка, панели, поле с картами и окна поверх. Состояние живёт в Pinia (match-store), анимации
 * ведёт AnimationDirector; сам компонент только соединяет их с разметкой и передаёт намерения игрока в команды.
 */
import type { Command } from '@space/engine'
import type { EndReason } from '@space/protocol'
import type { PileId } from '../modules/board'
import type { RematchStatus, Unspent } from '../modules/hud'
import type { MatchTransport } from '../store/match-store'
import { COMMAND_TYPE, PROMPT_KIND } from '@space/engine'
import { useEventListener, useMediaQuery } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import SpaceBackdrop from '@/common/ui/SpaceBackdrop.vue'
import StageScaler from '@/common/ui/StageScaler.vue'
import { HelpDialog } from '@/modules/help'
import { motionFactor, SettingsDialog, useSettings } from '@/modules/settings'
import { Board, NODE_GROUP, PILE_ID } from '../modules/board'
import { EndTurnDialog, GameOverScreen, HudLayer, itemsFromCards, itemsFromContents, PileViewer, unspentResources } from '../modules/hud'
import { PromptHost } from '../modules/prompts'
import { useMatchStore } from '../store/match-store'

const props = defineProps<{
  transport: MatchTransport
  /** Есть ли связь с сервером (для индикатора «В СЕТИ»). */
  online: boolean
  /** Соперник на связи. */
  opponentOnline: boolean
  /** Момент (Date.now()), когда отключившемуся сопернику засчитают сдачу; null, пока он на связи. */
  opponentReturnDeadline: number | null
  /** Имена игроков: ваше и соперника. */
  names: { self: string, opponent: string }
  /** Почему партия закончилась; null, пока она идёт. */
  endReason: EndReason | null
  /** Предложения реванша после конца партии. */
  rematch: RematchStatus
}>()

const emit = defineEmits<{
  leave: []
  /** Предложить реванш или принять предложение соперника. */
  rematch: []
}>()

const store = useMatchStore()
const { table, legalIndex, interactive, busy, speed, log, fx, banner, toast, deadline, timerTotal, selectedCardIds } = storeToRefs(store)

const board = useTemplateRef<InstanceType<typeof Board>>('board')

// Ввод и анимации идут в одной сцене. Скорость задают настройки игрока, а при сокращённых анимациях
// (в настройках или prefers-reduced-motion) переходы сжимаются почти в ноль.
const settings = useSettings()
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const motionScale = computed(() => motionFactor(settings.value, reducedMotion.value))
const layerSpeed = computed(() => speed.value * motionScale.value)

store.attach(props.transport, {
  setMotion: motion => board.value?.setMotion(motion),
  snapNext: () => board.value?.snapNext(),
  settled: () => board.value?.settled() ?? Promise.resolve(),
}, () => motionScale.value)

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
      return { title: `УТИЛЬ · ${table.value.scrapHeap.length}`, items: itemsFromCards(table.value.scrapHeap) }
  }
  return null
})

const gameOver = computed(() => {
  const state = table.value
  if (!state || state.winner === null || busy.value)
    return null
  return { win: state.winner === state.you, turn: state.turn }
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

// Если к концу хода осталась атака или торговля, которую ещё можно потратить, сначала спрашиваем.
const endTurnWarning = ref<Unspent | null>(null)

function requestEndTurn(): void {
  const unspent = table.value && settings.value.endTurnWarning ? unspentResources(table.value.pools, legalIndex.value) : null
  if (unspent)
    endTurnWarning.value = unspent
  else
    run({ type: COMMAND_TYPE.END_TURN })
}

const settingsOpen = ref(false)
const helpOpen = ref(false)

/*
 * Горячие клавиши: ? и F1 - справка; P - разыграть все, A - атаковать, E - конец хода (их можно выключить в
 * настройках). Ход работает по физическому положению клавиши (code), поэтому не зависит от раскладки.
 * Все отключены, пока открыто окно (запрос, стопка, предупреждение, настройки).
 */
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey)
    return
  const target = event.target
  if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)))
    return
  if (document.querySelector('[role="dialog"]'))
    return
  if (event.key === '?' || event.code === 'F1') {
    helpOpen.value = true
    event.preventDefault()
    return
  }
  if (!settings.value.hotkeys || !table.value || table.value.winner !== null || !interactive.value)
    return
  const legal = legalIndex.value
  if (event.code === 'KeyP' && !store.playingAll && store.playableCount > 0)
    store.playAll()
  else if (event.code === 'KeyA' && legal.attackPlayerAmount > 0)
    attackPlayer(legal.attackPlayerAmount)
  else if (event.code === 'KeyE' && legal.canEndTurn)
    requestEndTurn()
  else
    return
  event.preventDefault()
})

// Ход сменился сам (таймаут, сдача): предупреждение больше не нужно.
watch(() => table.value?.currentPlayer, () => {
  endTurnWarning.value = null
})

function confirmEndTurn(): void {
  endTurnWarning.value = null
  run({ type: COMMAND_TYPE.END_TURN })
}

// Когда открылся ваш запрос на сброс, фокус уходит в руку: карту для сброса выбирают в ней, а не в окне.
watch([() => table.value?.prompt?.id, busy], async () => {
  const prompt = table.value?.prompt
  if (prompt?.kind !== PROMPT_KIND.DISCARD || prompt.player !== table.value?.you || busy.value)
    return
  await nextTick()
  board.value?.focusGroup(NODE_GROUP.HAND)
})

// Выбор карты для сброса относится к конкретному prompt: новый prompt начинается без выбора.
const pending = computed(() => table.value?.prompt ?? null)
watch(pending, () => {
  selectedCardIds.value = []
})
</script>

<template>
  <StageScaler v-if="table">
    <template #backdrop>
      <!-- 30 кадров: шейдер почти неподвижен, а кадры нужны анимациям карт. -->
      <SpaceBackdrop :frame-rate="30" />
    </template>
    <div class="match">
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
        :self-name="names.self"
        :opponent-name="names.opponent"
        :opponent-online="opponentOnline"
        :opponent-return-deadline="opponentReturnDeadline"
        :play-all-count="store.playingAll ? 0 : store.playableCount"
        :finished="gameOver !== null"
        @attack="attackPlayer"
        @end-turn="requestEndTurn"
        @play-all="store.playAll()"
        @concede="run({ type: COMMAND_TYPE.CONCEDE })"
        @settings="settingsOpen = true"
        @help="helpOpen = true"
        @leave="emit('leave')"
      />

      <Board
        ref="board"
        :table="table"
        :legal="legalIndex"
        :interactive="interactive"
        :selected-card-ids="selectedCardIds"
        :speed="layerSpeed"
        :drag-enabled="settings.dragAndDrop"
        @command="run"
        @select="store.select"
        @view-pile="viewedPile = $event"
      />

      <PromptHost
        v-if="!busy && table.winner === null"
        :table="table"
        :legal="legalIndex"
        :deadline="deadline"
        :selected-card-ids="selectedCardIds"
        @command="run"
      />

      <EndTurnDialog
        v-if="endTurnWarning && table.winner === null"
        :unspent="endTurnWarning"
        @confirm="confirmEndTurn"
        @cancel="endTurnWarning = null"
      />

      <PileViewer v-if="viewedPileData" :title="viewedPileData.title" :items="viewedPileData.items" :note="viewedPileData.note" @close="viewedPile = null" />

      <SettingsDialog v-if="settingsOpen" @close="settingsOpen = false" />
      <HelpDialog v-if="helpOpen" @close="helpOpen = false" />

      <GameOverScreen
        v-if="gameOver && showGameOver"
        :win="gameOver.win"
        :turn="gameOver.turn"
        :reason="endReason"
        :self-name="names.self"
        :opponent-name="names.opponent"
        :rematch="rematch"
        @rematch="emit('rematch')"
        @main-menu="emit('leave')"
        @view-field="hideGameOver = true"
      />
      <button v-if="gameOver && !showGameOver" type="button" class="match__result" @click="hideGameOver = false">
        {{ gameOver.win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ' }} · ИТОГИ
      </button>

      <p v-if="toast" class="match__toast" role="alert">
        {{ toast }}
      </p>
    </div>
  </StageScaler>
</template>

<style scoped>
.match {
  position: absolute;
  inset: 0;
  overflow: clip;
  font-family: var(--font-text);
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
