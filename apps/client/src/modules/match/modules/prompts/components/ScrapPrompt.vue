<script setup lang="ts">
import type { CardInstance, ScrapZone } from '@space/engine'
import type { LegalIndex, TableState } from '../../table'
import { SCRAP_ZONE } from '@space/engine'
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
  zones: ScrapZone[]
  optional: boolean
  /** Сколько карт ещё можно утилизировать (Brain World: до двух). */
  remaining?: number
  /** За каждую утилизированную карту берётся новая. */
  drawPerScrap?: boolean
  source: CardInstance | null
  deadline: number | null
}>()

const emit = defineEmits<{
  choose: [cardId: string]
  skip: []
}>()

const selected = ref<string | null>(null)

const ZONE_TITLE: Record<ScrapZone, string> = {
  [SCRAP_ZONE.HAND]: 'РУКА',
  [SCRAP_ZONE.DISCARD]: 'СБРОС',
  [SCRAP_ZONE.TRADE_ROW]: 'ТОРГОВЫЙ РЯД',
}

function cardsIn(zone: ScrapZone): CardInstance[] {
  const { table } = props
  const list = zone === SCRAP_ZONE.HAND
    ? table.self.hand
    : zone === SCRAP_ZONE.DISCARD
      ? table.self.discard
      : table.tradeRow.filter((card): card is CardInstance => card !== null)
  return list.filter(card => props.legal.promptCards.has(card.id))
}

const sections = computed(() => props.zones
  .map(zone => ({ zone, title: ZONE_TITLE[zone], cards: cardsIn(zone) }))
  .filter(section => section.cards.length > 0))

const selectedCard = computed(() => sections.value.flatMap(section => section.cards).find(card => card.id === selected.value) ?? null)
const title = computed(() => (props.source ? cardName(props.source.cardId) : 'Утилизация'))
const lead = computed(() => {
  const draw = props.drawPerScrap ? ' За каждую вы возьмёте новую карту.' : ''
  if ((props.remaining ?? 1) > 1)
    return `Можно навсегда убрать на свалку до ${props.remaining} карт, по одной.${draw}`
  return props.optional
    ? `Можно навсегда убрать одну карту на свалку.${draw}`
    : `Выберите карту, которую нужно навсегда убрать на свалку.${draw}`
})

function confirm(): void {
  if (selected.value)
    emit('choose', selected.value)
}
</script>

<template>
  <AppDialog :title="title" :eyebrow="`УТИЛИЗАЦИЯ · ${optional ? 'ПО ЖЕЛАНИЮ' : 'ОБЯЗАТЕЛЬНО'}`" :width="1040">
    <template #header-extra>
      <PromptTimer :deadline="deadline" />
    </template>

    <p class="lead">
      {{ lead }}
    </p>

    <div v-for="section in sections" :key="section.zone" class="section">
      <p class="section__title">
        {{ section.title }} · {{ section.cards.length }}
      </p>
      <div class="section__cards">
        <button
          v-for="card in section.cards"
          :key="card.id"
          type="button"
          class="pick"
          :aria-label="`Утилизировать «${cardName(card.cardId)}»`"
          :aria-pressed="selected === card.id"
          @click="selected = selected === card.id ? null : card.id"
        >
          <CardThumb :card-id="card.cardId" :scale="0.7" zoom :state="selected === card.id ? CARD_STATE.SELECTED : CARD_STATE.SELECTABLE" />
        </button>
      </div>
    </div>

    <template #footer>
      <p class="note">
        <AppIcon :name="ICON.CLOCK" :size="14" />
        <span>{{ optional ? 'Если время выйдет, утилизация будет пропущена.' : 'Если время выйдет, сервер выберет первую карту.' }}</span>
      </p>
      <GameButton v-if="optional" variant="ghost" :height="52" @click="emit('skip')">
        Пропустить
      </GameButton>
      <GameButton :height="52" :disabled="!selectedCard" @click="confirm">
        <AppIcon :name="ICON.SCRAP" :size="17" :stroke="2.2" />
        <span>{{ selectedCard ? `Утилизировать «${cardName(selectedCard.cardId)}»` : 'Выберите карту' }}</span>
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
