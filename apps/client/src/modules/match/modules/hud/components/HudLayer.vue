<script setup lang="ts">
/*
 * Панели вокруг стола: игроки, журнал, ход и пулы, меню. Расположены по сетке сцены (lib/rects.ts), чтобы совпадать
 * с зонами и позициями карт, которые считает Board.
 */
import type { LegalIndex, TableState } from '../../table'
import type { LogEntry } from '../lib/describe'
import type { FxItem, TurnBanner } from '../lib/fx'
import { CARD_KIND, getCard } from '@space/engine'
import { computed } from 'vue'
import { RECT, rectStyle } from '../../../lib/rects'
import { FX_TARGET } from '../lib/fx'
import { hintFor, turnInfo } from '../lib/turn-info'
import GameLog from './GameLog.vue'
import MatchMenu from './MatchMenu.vue'
import OpponentPanel from './OpponentPanel.vue'
import SelfPanel from './SelfPanel.vue'
import TurnBannerView from './TurnBannerView.vue'
import TurnPanel from './TurnPanel.vue'

const props = defineProps<{
  table: TableState
  legal: LegalIndex
  /** Принимается ли сейчас ввод. */
  interactive: boolean
  log: LogEntry[]
  deadline: number | null
  timerTotal: number
  fx: FxItem[]
  banner: TurnBanner | null
  online: boolean
  selfName: string
  opponentName: string
  opponentOnline: boolean
  opponentReturnDeadline: number | null
  playAllCount: number
}>()

const emit = defineEmits<{
  attack: [amount: number]
  endTurn: []
  playAll: []
  concede: []
  settings: []
  help: []
}>()

const mine = computed(() => props.table.currentPlayer === props.table.you)
const opponentHasOutpost = computed(() => props.table.opponent.inPlay.some(entry => getCard(entry.card.cardId).kind === CARD_KIND.OUTPOST))
const attackAmount = computed(() => (props.interactive ? props.legal.attackPlayerAmount : 0))
const canEndTurn = computed(() => props.interactive && props.legal.canEndTurn)

const selfFx = computed(() => props.fx.filter(item => item.target === FX_TARGET.SELF_AUTHORITY))
const opponentFx = computed(() => props.fx.filter(item => item.target === FX_TARGET.OPPONENT_AUTHORITY))
const info = computed(() => turnInfo(props.table))
const hint = computed(() => hintFor(props.table, props.legal))
</script>

<template>
  <div class="hud">
    <div class="hud__slot" :style="rectStyle(RECT.OPP_PANEL)">
      <OpponentPanel
        :name="opponentName"
        :authority="table.opponent.authority"
        :hand-count="table.opponent.handCount"
        :active="!mine"
        :protected-by-outpost="opponentHasOutpost"
        :attack-amount="attackAmount"
        :online="opponentOnline"
        :return-deadline="opponentReturnDeadline"
        :fx="opponentFx"
        @attack="emit('attack', attackAmount)"
      />
    </div>

    <div class="hud__slot" :style="rectStyle(RECT.LOG)">
      <GameLog :entries="log" />
    </div>

    <div class="hud__slot" :style="rectStyle(RECT.TURN)">
      <TurnPanel
        :turn="table.turn"
        :info="info"
        :hint="hint"
        :pools="table.pools"
        :deadline="deadline"
        :timer-total="timerTotal"
        :can-end-turn="canEndTurn"
        :play-all-count="playAllCount"
        :attack-amount="attackAmount"
        :fx="fx"
        @end-turn="emit('endTurn')"
        @play-all="emit('playAll')"
        @attack="emit('attack', attackAmount)"
      />
    </div>

    <div class="hud__slot" :style="rectStyle(RECT.SELF_PANEL)">
      <SelfPanel :name="selfName" :authority="table.self.authority" :active="mine" :online="online" :fx="selfFx" />
    </div>

    <div class="hud__menu">
      <MatchMenu @concede="emit('concede')" @settings="emit('settings')" @help="emit('help')" />
    </div>

    <TurnBannerView :banner="banner" />
  </div>
</template>

<style scoped>
.hud {
  position: absolute;
  inset: 0;
}

.hud__slot {
  position: absolute;
}

.hud__menu {
  position: absolute;
  top: 40px;
  left: 1566px;
  /* Выше окон выбора (500) и просмотра стопок (550): сдаться можно и тогда, когда открыт prompt. Ниже итогов матча (600). */
  z-index: 560;
}
</style>
