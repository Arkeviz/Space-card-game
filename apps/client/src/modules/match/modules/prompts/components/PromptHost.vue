<script setup lang="ts">
/*
 * Показывает окно для открытого prompt, если отвечать на него должен этот игрок. Если prompt открыт у соперника,
 * ничего не рисуется: об ожидании сообщает панель хода.
 */
import type { Command } from '@space/engine'
import type { LegalIndex, TableState } from '../../table'
import { COMMAND_TYPE, PROMPT_KIND } from '@space/engine'
import { computed } from 'vue'
import { discardLimit } from '../../table'
import { findSourceCard } from '../lib/prompt-info'
import ChoicePrompt from './ChoicePrompt.vue'
import DiscardPrompt from './DiscardPrompt.vue'
import PickCardPrompt from './PickCardPrompt.vue'
import ScrapPrompt from './ScrapPrompt.vue'

const props = defineProps<{
  table: TableState
  legal: LegalIndex
  deadline: number | null
  /** Карты, выбранные в руке для сброса. */
  selectedCardIds: readonly string[]
}>()

const emit = defineEmits<{ command: [command: Command] }>()

const prompt = computed(() => (props.table.prompt && props.table.prompt.player === props.table.you ? props.table.prompt : null))
const source = computed(() => (prompt.value ? findSourceCard(props.table, prompt.value.source) : null))
const limit = computed(() => discardLimit(props.table))

function choose(index: number): void {
  if (prompt.value)
    emit('command', { type: COMMAND_TYPE.CHOOSE_OPTION, promptId: prompt.value.id, index })
}

function chooseCard(cardId: string): void {
  if (prompt.value)
    emit('command', { type: COMMAND_TYPE.CHOOSE_CARD, promptId: prompt.value.id, cardId })
}

/** Сброс: одна карта - обычным ответом, несколько - одним ответом на весь запрос. */
function discard(): void {
  if (!prompt.value || props.selectedCardIds.length === 0)
    return
  if (limit.value <= 1)
    emit('command', { type: COMMAND_TYPE.CHOOSE_CARD, promptId: prompt.value.id, cardId: props.selectedCardIds[0]! })
  else
    emit('command', { type: COMMAND_TYPE.CHOOSE_CARDS, promptId: prompt.value.id, cardIds: [...props.selectedCardIds] })
}

function skip(): void {
  if (prompt.value)
    emit('command', { type: COMMAND_TYPE.SKIP, promptId: prompt.value.id })
}
</script>

<template>
  <template v-if="prompt">
    <ChoicePrompt
      v-if="prompt.kind === PROMPT_KIND.CHOICE"
      :key="prompt.id"
      :table="table"
      :options="prompt.options"
      :source="source"
      :deadline="deadline"
      @choose="choose"
    />
    <ScrapPrompt
      v-else-if="prompt.kind === PROMPT_KIND.SCRAP"
      :key="prompt.id"
      :table="table"
      :legal="legal"
      :zones="prompt.zones"
      :optional="prompt.optional"
      :remaining="prompt.remaining"
      :draw-per-scrap="prompt.drawPerScrap"
      :source="source"
      :deadline="deadline"
      @choose="chooseCard"
      @skip="skip"
    />
    <PickCardPrompt
      v-else-if="prompt.kind === PROMPT_KIND.DESTROY_BASE || prompt.kind === PROMPT_KIND.ACQUIRE_SHIP || prompt.kind === PROMPT_KIND.COPY_SHIP"
      :key="prompt.id"
      :table="table"
      :legal="legal"
      :kind="prompt.kind"
      :optional="prompt.kind === PROMPT_KIND.DESTROY_BASE && prompt.optional"
      :source="source"
      :deadline="deadline"
      @choose="chooseCard"
      @skip="skip"
    />
    <DiscardPrompt
      v-else
      :key="prompt.id"
      :source="source"
      :selected-count="selectedCardIds.length"
      :limit="limit"
      :deadline="deadline"
      :optional="prompt.optional"
      @confirm="discard"
      @skip="skip"
    />
  </template>
</template>
