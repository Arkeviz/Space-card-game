<script setup lang="ts">
/*
 * Игровое поле: подложка зон, стопки, подписи и слой карт. Позиции берутся из lib/layout.ts (одни и те же числа
 * для вёрстки зон и для анимации карт). Сам Board ничего не знает о сервере: наружу уходят намерения игрока.
 */
import type { Command } from '@space/engine'
import type { LegalIndex, TableState } from '../../table'
import type { FieldFrame } from '../lib/layout'
import type { Motion } from '../lib/motion'
import type { CardNode } from '../lib/nodes'
import type { PileId } from '../lib/piles'
import { CARD_KIND, getCard } from '@space/engine'
import { computed, ref, useTemplateRef } from 'vue'
import AppIcon from '@/common/ui/AppIcon.vue'
import { ICON } from '@/common/ui/icons'
import { CARD_FORM, CARD_SIZE, cardName, CardView } from '@/modules/cards'
import { STAGE } from '../../../lib/rects'
import {
  fieldGeometry,
  layoutOf,
  opponentDeckPose,
  PILE,
  PREVIEW_SCALE,
  previewPlacement,
  SCALE,
  selfDeckPose,
  TRADE_SLOT_W,
  tradeSlotX,
} from '../lib/layout'
import { buildNodes, NODE_CLICK, NODE_ZONE, tradeCaption } from '../lib/nodes'
import { PILE_ID } from '../lib/piles'
import CardLayer from './CardLayer.vue'
import PileStack from './PileStack.vue'

const props = defineProps<{
  table: TableState
  legal: LegalIndex
  /** Принимается ли сейчас ввод (очередь анимаций пуста и нет ожидающей команды). */
  interactive: boolean
  /** Карты, выбранные в prompt сброса. */
  selectedCardIds: readonly string[]
  speed: number
}>()

const emit = defineEmits<{
  command: [command: Command]
  select: [cardId: string]
  viewPile: [pile: PileId]
}>()

const layer = useTemplateRef<InstanceType<typeof CardLayer>>('layer')
const hoverKey = ref<string | null>(null)

const nodes = computed(() => buildNodes(props.table, {
  legal: props.legal,
  interactive: props.interactive,
  hoverKey: hoverKey.value,
  selectedCardIds: props.selectedCardIds,
}))

const layout = computed(() => layoutOf(props.table))
const trade = computed(() => layout.value.trade)

const baseCount = (entries: TableState['self']['inPlay']): number => entries.filter(entry => getCard(entry.card.cardId).kind !== CARD_KIND.SHIP).length

/** Прямоугольник поля, подписи и разделитель зон для разметки. Сжатое поле показывает только «БАЗЫ». */
function fieldView(frame: FieldFrame, count: number) {
  const zone = fieldGeometry(frame, count)
  const { rect } = frame
  return {
    style: { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` },
    compact: frame.compact,
    dividerLeft: zone.dividerX === null ? null : `${zone.dividerX - rect.x}px`,
    shipsLabelLeft: zone.shipsLabelX === null ? null : `${zone.shipsLabelX - rect.x}px`,
  }
}

const opponentField = computed(() => fieldView(layout.value.opponentField, baseCount(props.table.opponent.inPlay)))
const selfField = computed(() => fieldView(layout.value.selfField, baseCount(props.table.self.inPlay)))

const myTurn = computed(() => props.interactive && props.legal.canEndTurn)

const captions = computed(() => props.table.tradeRow.map((card) => {
  if (!card)
    return { text: '', affordable: false }
  return tradeCaption(getCard(card.cardId).cost, props.table.pools.trade, myTurn.value)
}))

/**
 * Крупный просмотр карты, на которую наведён курсор: на поле и в ряду карты мелкие, текст способностей не
 * прочитать. Карты руки и так крупные, стопки и утиль - просто картинки без наведения.
 */
const preview = computed(() => {
  const node = nodes.value.find(item => item.key === hoverKey.value)
  if (!node?.cardId || node.decorative || node.zone === NODE_ZONE.HAND)
    return null
  const natural = node.form === CARD_FORM.DEPLOYED ? CARD_SIZE.DEPLOYED : CARD_SIZE.CARD
  return { node, at: previewPlacement(node.pose, natural.h, STAGE) }
})

function onClick(node: CardNode): void {
  if (!node.click)
    return
  if (node.click.kind === NODE_CLICK.COMMAND)
    emit('command', node.click.command)
  else
    emit('select', node.click.cardId)
}

function onScrap(node: CardNode): void {
  if (node.scrapCommand)
    emit('command', node.scrapCommand)
}

defineExpose({
  setMotion(motion: Motion): void {
    layer.value?.setMotion(motion)
  },
  snapNext(): void {
    layer.value?.snapNext()
  },
  settled(): Promise<void> {
    return layer.value?.settled() ?? Promise.resolve()
  },
})
</script>

<template>
  <div class="board">
    <!-- Торговый ряд -->
    <div
      class="board__trade-band"
      :style="{ top: `${trade.rect.y}px`, height: `${trade.rect.h}px` }"
    />
    <p class="board__vlabel" :style="{ left: `${trade.labelX}px`, top: `${trade.rect.y}px`, height: `${trade.rect.h}px` }">
      ТОРГОВЫЙ РЯД
    </p>
    <div class="board__vline" :style="{ left: `${trade.dividerLeftX}px`, top: `${trade.dividerTop}px`, height: `${trade.dividerH}px` }" />
    <div class="board__vline" :style="{ left: `${trade.dividerRightX}px`, top: `${trade.dividerTop}px`, height: `${trade.dividerH}px` }" />

    <p
      v-for="(caption, slot) in captions"
      :key="slot"
      class="board__caption"
      :class="{ 'board__caption--ready': caption.affordable }"
      :style="{ left: `${tradeSlotX(trade, slot) - TRADE_SLOT_W / 2}px`, top: `${trade.captionY - 8}px`, width: `${TRADE_SLOT_W}px` }"
    >
      {{ caption.text }}
    </p>

    <PileStack
      v-if="table.explorersCount > 0"
      :x="trade.explorersX"
      :y="trade.cardY"
      :scale="SCALE.TRADE"
      :count="table.explorersCount"
      :label="`ИССЛЕДОВАТЕЛИ · ${table.explorersCount}`"
      tone="steel"
      :show-badge="false"
      :aria-label="`Исследователи: ${table.explorersCount}`"
    />

    <PileStack
      :x="trade.deck.x"
      :y="trade.deck.y"
      :scale="SCALE.TRADE_DECK"
      :count="table.tradeDeckCount"
      label="КОЛОДА РЫНКА"
      back
    />
    <button
      type="button"
      class="board__scrap-button"
      :style="{ left: `${trade.scrap.x - trade.scrap.w / 2}px`, top: `${trade.scrap.y - trade.scrap.h / 2}px`, width: `${trade.scrap.w}px`, height: `${trade.scrap.h}px` }"
      :aria-label="`Утиль: ${table.scrapHeap.length}`"
      @click="emit('viewPile', PILE_ID.SCRAP_HEAP)"
    >
      <AppIcon :name="ICON.SCRAP" :size="15" :stroke="1.8" />
      <span>Утиль · {{ table.scrapHeap.length }}</span>
    </button>

    <!-- Поля игроков -->
    <section class="board__field board__field--opponent" aria-label="Поле соперника" :style="opponentField.style">
      <span class="board__field-label" style="left: 12px">БАЗЫ</span>
      <template v-if="!opponentField.compact">
        <span class="board__field-line" :style="{ left: opponentField.dividerLeft ?? undefined }" />
        <span class="board__field-label" :style="{ left: opponentField.shipsLabelLeft ?? undefined }">КОРАБЛИ</span>
      </template>
    </section>
    <section class="board__field board__field--self" aria-label="Ваше поле" :style="selfField.style">
      <span class="board__field-label" style="left: 12px">БАЗЫ</span>
      <template v-if="!selfField.compact">
        <span class="board__field-line" :style="{ left: selfField.dividerLeft ?? undefined }" />
        <span class="board__field-label" :style="{ left: selfField.shipsLabelLeft ?? undefined }">КОРАБЛИ</span>
      </template>
    </section>

    <!-- Колоды и сбросы -->
    <PileStack :x="selfDeckPose().x" :y="selfDeckPose().y" :scale="SCALE.PILE" :count="table.self.deckCount" label="КОЛОДА" back />
    <button
      type="button"
      class="board__pile-hit"
      :style="{ left: `${PILE.selfDeck.x - 55}px`, top: `${PILE.selfDeck.y - 77}px`, width: '110px', height: '154px' }"
      :aria-label="`Ваша колода: ${table.self.deckCount} карт, показать состав`"
      @click="emit('viewPile', PILE_ID.SELF_DECK)"
    />
    <PileStack :x="PILE.selfDiscard.x" :y="PILE.selfDiscard.y" :scale="SCALE.PILE" :count="table.self.discard.length" label="СБРОС" tone="steel" />
    <button
      type="button"
      class="board__pile-hit"
      :style="{ left: `${PILE.selfDiscard.x - 55}px`, top: `${PILE.selfDiscard.y - 77}px`, width: '110px', height: '154px' }"
      :aria-label="`Ваш сброс: ${table.self.discard.length} карт`"
      @click="emit('viewPile', PILE_ID.SELF_DISCARD)"
    />

    <PileStack :x="opponentDeckPose().x" :y="opponentDeckPose().y" :scale="SCALE.OPP_PILE" :count="table.opponent.deckCount" label="КОЛОДА" back compact />
    <PileStack :x="PILE.opponentDiscard.x" :y="PILE.opponentDiscard.y" :scale="SCALE.OPP_PILE" :count="table.opponent.discard.length" label="СБРОС" tone="steel" compact />
    <button
      type="button"
      class="board__pile-hit"
      :style="{ left: `${PILE.opponentDiscard.x - 26}px`, top: `${PILE.opponentDiscard.y - 37}px`, width: '52px', height: '73px' }"
      :aria-label="`Сброс соперника: ${table.opponent.discard.length} карт`"
      @click="emit('viewPile', PILE_ID.OPPONENT_DISCARD)"
    />

    <CardLayer
      ref="layer"
      :nodes="nodes"
      :speed="speed"
      @click="onClick"
      @highlight="hoverKey = $event"
      @scrap="onScrap"
    />

    <div
      v-if="preview && preview.node.cardId"
      class="board__preview"
      :style="{ left: `${preview.at.x}px`, top: `${preview.at.y}px`, transform: `translate(-50%, -50%) scale(${PREVIEW_SCALE})` }"
      aria-hidden="true"
    >
      <CardView
        :card-id="preview.node.cardId"
        :form="CARD_FORM.CARD"
        :basic="preview.node.basic"
        :ally="preview.node.ally"
        :scrap="preview.node.scrap"
      />
      <span class="visually-hidden">{{ cardName(preview.node.cardId) }}</span>
    </div>
  </div>
</template>

<style scoped>
.board {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.board > * {
  position: absolute;
}

/* Поля и торговый ряд меняют высоту при смене хода: подложки плавно подстраиваются, как и сами карты. */
.board__trade-band {
  right: 0;
  left: 0;
  background: linear-gradient(180deg, rgba(79, 216, 255, 0.045) 0%, rgba(79, 216, 255, 0.015) 100%);
  border-top: 1px solid rgba(79, 216, 255, 0.16);
  border-bottom: 1px solid rgba(79, 216, 255, 0.16);
  transition: top 0.55s, height 0.55s;
}

.board__vlabel {
  display: flex;
  align-items: center;
  width: 14px;
  color: #6fb9d6;
  font: 600 12px/1 var(--font-mono);
  letter-spacing: 0.22em;
  white-space: nowrap;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  transition: top 0.55s, height 0.55s;
}

.board__vline {
  width: 1px;
  background: rgba(79, 216, 255, 0.22);
  transition: top 0.55s, height 0.55s;
}

.board__caption {
  height: 16px;
  color: #6f84ad;
  font: 600 13px/16px var(--font-mono);
  letter-spacing: 0.16em;
  text-align: center;
  transition: top 0.55s;
}

.board__caption--ready {
  color: var(--c-trade);
}

.board__scrap-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: rgba(201, 214, 240, 0.06);
  color: var(--c-text-quiet);
  font: 600 12px/1 var(--font-mono);
  letter-spacing: 0.14em;
  box-shadow: inset 0 0 0 1px rgba(201, 214, 240, 0.25);
  cursor: pointer;
  pointer-events: auto;
  transition: top 0.55s;
}

.board__scrap-button:hover {
  background: rgba(201, 214, 240, 0.12);
}

.board__field {
  background: rgba(79, 216, 255, 0.025);
  box-shadow: inset 0 0 0 1px rgba(79, 216, 255, 0.12);
  transition: top 0.55s, height 0.55s;
}

.board__field--opponent {
  background: rgba(179, 156, 255, 0.025);
  box-shadow: inset 0 0 0 1px rgba(179, 156, 255, 0.12);
}

.board__field-label {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  width: 14px;
  color: var(--c-dim);
  font: 600 12px/1 var(--font-mono);
  letter-spacing: 0.22em;
  white-space: nowrap;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  transition: left 0.4s;
}

.board__field-line {
  position: absolute;
  top: 22px;
  bottom: 22px;
  width: 1px;
  background: rgba(143, 163, 200, 0.18);
  transition: left 0.4s;
}

.board__pile-hit {
  z-index: 10;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  pointer-events: auto;
}

.board__preview {
  z-index: 300;
  filter: drop-shadow(0 18px 40px rgba(0, 0, 0, 0.7));
}
</style>
