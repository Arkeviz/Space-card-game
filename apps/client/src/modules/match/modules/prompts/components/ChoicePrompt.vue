<script setup lang="ts">
import type { CardInstance, Effect } from '@space/engine'
import type { TableState } from '../../table'
import { CARD_KIND, getCard } from '@space/engine'
import { onKeyStroke } from '@vueuse/core'
import { computed } from 'vue'
import AppDialog from '@/common/ui/AppDialog.vue'
import AppIcon from '@/common/ui/AppIcon.vue'
import { CARD_FORM, cardName, CardThumb, describeEffectShort, effectTokens, TOKEN_KIND } from '@/modules/cards'
import { previewOption } from '../lib/prompt-info'
import PromptTimer from './PromptTimer.vue'

const props = defineProps<{
  table: TableState
  options: Effect[][]
  source: CardInstance | null
  deadline: number | null
}>()

const emit = defineEmits<{ choose: [index: number] }>()

const items = computed(() => props.options.map((option, index) => ({
  index,
  chips: option.flatMap(effectTokens).filter(token => token.kind === TOKEN_KIND.CHIP),
  // Число уже показано крупным чипом: в подписи остаётся только слово («авторитета», «торговли»).
  text: option.map(describeEffectShort).join(', ').replace(/^\+\d+\s+/, ''),
  preview: previewOption(props.table, option),
})))

const title = computed(() => (props.source ? cardName(props.source.cardId) : 'Выбор эффекта'))
const deployed = computed(() => (props.source && getCard(props.source.cardId).kind !== CARD_KIND.SHIP ? CARD_FORM.DEPLOYED : CARD_FORM.CARD))

// Цифры 1-9 выбирают вариант с этим номером, как подсказывают значки на кнопках.
onKeyStroke(['1', '2', '3', '4', '5', '6', '7', '8', '9'], (event) => {
  const index = Number(event.key) - 1
  if (index < props.options.length)
    emit('choose', index)
})
</script>

<template>
  <AppDialog :title="title" eyebrow="ВЫБОР ЭФФЕКТА · ОБЯЗАТЕЛЬНО">
    <template #header-extra>
      <PromptTimer :deadline="deadline" />
    </template>

    <div class="source">
      <CardThumb v-if="source" :card-id="source.cardId" :form="deployed" :scale="0.9" zoom />
      <p class="source__lead">
        Выберите один эффект: второй не сработает.
      </p>
    </div>

    <div class="options">
      <button
        v-for="item in items"
        :key="item.index"
        type="button"
        class="option"
        :aria-label="`Вариант ${item.index + 1}: ${item.text}`"
        @click="emit('choose', item.index)"
      >
        <span class="option__line">
          <template v-for="(chip, chipIndex) in item.chips" :key="chipIndex">
            <span v-if="chip.kind === TOKEN_KIND.CHIP" class="option__chip" :style="{ color: chip.color }">
              <AppIcon :name="chip.icon" :size="28" :stroke="2" />
              <span class="option__value">{{ chip.value }}</span>
            </span>
          </template>
          <span class="option__name">{{ item.text }}</span>
          <span class="option__key">{{ item.index + 1 }}</span>
        </span>
        <span class="option__preview">{{ item.preview }}</span>
      </button>
    </div>

    <template #footer>
      <span class="foot">Если время выйдет, сервер выберет первый вариант.</span>
    </template>
  </AppDialog>
</template>

<style scoped>
.source {
  display: flex;
  gap: 28px;
  align-items: center;
}

.source__lead {
  margin: 0;
  color: var(--c-text-soft);
  font: 400 16px/22px var(--font-text);
}

.options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.option {
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: center;
  height: 116px;
  margin: 0;
  padding: 0 20px;
  border: 0;
  background: rgba(79, 216, 255, 0.05);
  color: var(--c-text);
  text-align: left;
  box-shadow: inset 0 0 0 1px rgba(79, 216, 255, 0.35);
  cursor: pointer;
}

.option:hover,
.option:focus-visible {
  background: rgba(79, 216, 255, 0.1);
  box-shadow: inset 0 0 0 2px var(--c-me), 0 0 26px rgba(79, 216, 255, 0.28);
}

.option__line {
  display: flex;
  gap: 12px;
  align-items: center;
}

.option__chip {
  display: flex;
  gap: 10px;
  align-items: center;
}

.option__value {
  color: var(--c-text);
  font: 800 30px/1 var(--font-display);
}

.option__name {
  font: 600 17px/1 var(--font-text);
}

.option__key {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: auto;
  color: var(--c-muted);
  font: 600 13px/1 var(--font-mono);
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.45);
}

.option__preview {
  color: #9fb2d6;
  font: 400 16px/1.2 var(--font-text);
}

.foot {
  color: var(--c-muted);
  font: 400 15px/20px var(--font-text);
}
</style>
