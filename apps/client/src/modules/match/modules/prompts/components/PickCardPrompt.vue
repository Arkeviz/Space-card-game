<script setup lang="ts">
/*
 * Выбор одной карты-цели: уничтожаемая база соперника, получаемый бесплатно корабль или копируемый корабль.
 * Кандидатов определяет сервер (legal.promptCards), здесь они только раскладываются по зонам для показа.
 */
import type { CardInstance } from '@space/engine'
import type { LegalIndex, TableState } from '../../table'
import { PROMPT_KIND } from '@space/engine'
import { computed, ref } from 'vue'
import AppDialog from '@/common/ui/AppDialog.vue'
import AppIcon from '@/common/ui/AppIcon.vue'
import GameButton from '@/common/ui/GameButton.vue'
import { ICON } from '@/common/ui/icons'
import { CARD_STATE, cardName, CardThumb } from '@/modules/cards'
import PromptTimer from './PromptTimer.vue'

const props = defineProps<{
  table: TableState
  legal: LegalIndex
  kind: typeof PROMPT_KIND.DESTROY_BASE | typeof PROMPT_KIND.ACQUIRE_SHIP | typeof PROMPT_KIND.COPY_SHIP
  optional: boolean
  source: CardInstance | null
  deadline: number | null
}>()

const emit = defineEmits<{
  choose: [cardId: string]
  skip: []
}>()

interface Option {
  id: string
  cardId: string
}

const TEXTS = {
  [PROMPT_KIND.DESTROY_BASE]: {
    eyebrow: 'УНИЧТОЖЕНИЕ БАЗЫ',
    lead: 'Выберите базу или аванпост соперника: она будет уничтожена без затрат атаки.',
    section: 'БАЗЫ СОПЕРНИКА',
    fallback: 'Сервер выберет первую базу.',
    action: 'Уничтожить',
  },
  [PROMPT_KIND.ACQUIRE_SHIP]: {
    eyebrow: 'ПОЛУЧЕНИЕ КОРАБЛЯ · ОБЯЗАТЕЛЬНО',
    lead: 'Выберите корабль из торгового ряда или Исследователя: он достанется бесплатно и ляжет на верх вашей колоды.',
    section: 'ТОРГОВЫЙ РЯД И ИССЛЕДОВАТЕЛИ',
    fallback: 'Сервер выберет первый корабль.',
    action: 'Получить',
  },
  [PROMPT_KIND.COPY_SHIP]: {
    eyebrow: 'КОПИРОВАНИЕ · ОБЯЗАТЕЛЬНО',
    lead: 'Выберите корабль, сыгранный в этот ход: карта повторит его способность и получит его фракцию.',
    section: 'ВАШИ КОРАБЛИ',
    fallback: 'Сервер выберет первый корабль.',
    action: 'Скопировать',
  },
} as const

const selected = ref<string | null>(null)

const options = computed<Option[]>(() => {
  const { table, legal } = props
  if (props.kind === PROMPT_KIND.DESTROY_BASE)
    return table.opponent.inPlay.filter(entry => legal.promptCards.has(entry.card.id)).map(entry => ({ id: entry.card.id, cardId: entry.card.cardId }))
  if (props.kind === PROMPT_KIND.COPY_SHIP)
    return table.self.inPlay.filter(entry => legal.promptCards.has(entry.card.id)).map(entry => ({ id: entry.card.id, cardId: entry.copyOf ?? entry.card.cardId }))

  // Корабли ряда известны столу, а верхний Исследователь - нет: его id приходит только в списке допустимых команд.
  const fromRow: Option[] = table.tradeRow
    .filter((card): card is CardInstance => card !== null && legal.promptCards.has(card.id))
    .map(card => ({ id: card.id, cardId: card.cardId }))
  const known = new Set(fromRow.map(option => option.id))
  const explorers: Option[] = [...legal.promptCards].filter(id => !known.has(id)).map(id => ({ id, cardId: 'explorer' }))
  return [...fromRow, ...explorers]
})

const texts = computed(() => TEXTS[props.kind])
const title = computed(() => (props.source ? cardName(props.source.cardId) : texts.value.eyebrow))
const eyebrow = computed(() => (props.kind === PROMPT_KIND.DESTROY_BASE ? `${texts.value.eyebrow} · ${props.optional ? 'ПО ЖЕЛАНИЮ' : 'ОБЯЗАТЕЛЬНО'}` : texts.value.eyebrow))
const chosen = computed(() => options.value.find(option => option.id === selected.value) ?? null)

function confirm(): void {
  if (selected.value)
    emit('choose', selected.value)
}
</script>

<template>
  <AppDialog :title="title" :eyebrow="eyebrow" :width="1040">
    <template #header-extra>
      <PromptTimer :deadline="deadline" />
    </template>

    <p class="lead">
      {{ texts.lead }}
    </p>

    <div class="section">
      <p class="section__title">
        {{ texts.section }} · {{ options.length }}
      </p>
      <div class="section__cards">
        <button
          v-for="option in options"
          :key="option.id"
          type="button"
          class="pick"
          :aria-label="`${texts.action} «${cardName(option.cardId)}»`"
          :aria-pressed="selected === option.id"
          @click="selected = selected === option.id ? null : option.id"
        >
          <CardThumb :card-id="option.cardId" :scale="0.7" zoom :state="selected === option.id ? CARD_STATE.SELECTED : CARD_STATE.SELECTABLE" />
        </button>
      </div>
    </div>

    <template #footer>
      <p class="note">
        <AppIcon :name="ICON.CLOCK" :size="14" />
        <span>{{ optional ? 'Если время выйдет, шаг будет пропущен.' : `Если время выйдет, ${texts.fallback.toLowerCase()}` }}</span>
      </p>
      <GameButton v-if="optional" variant="ghost" :height="52" @click="emit('skip')">
        Пропустить
      </GameButton>
      <GameButton :height="52" :disabled="!chosen" @click="confirm">
        {{ chosen ? `${texts.action} «${cardName(chosen.cardId)}»` : 'Выберите карту' }}
      </GameButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.lead {
  margin: 0;
  color: var(--c-text-soft);
  font: 400 16px/22px var(--font-text);
}

.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section__title {
  color: var(--c-muted);
  font: 600 12px/1 var(--font-mono);
  letter-spacing: 0.18em;
}

.section__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding-top: 10px;
}

.pick {
  display: block;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

.note {
  display: flex;
  flex: 1;
  gap: 8px;
  align-items: center;
  color: var(--c-muted);
  font: 400 15px/20px var(--font-text);
}
</style>
