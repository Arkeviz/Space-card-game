<script setup lang="ts">
import type { AbilityKind } from '@space/engine'
import type { AbilityStatus } from '../lib/card-meta'
import type { CardForm, CardVisualState } from '../lib/card-visual'
import { ABILITY_KIND, CARD_KIND, getCard } from '@space/engine'
import { computed } from 'vue'
import AppIcon from '@/common/ui/AppIcon.vue'
import { ICON } from '@/common/ui/icons'
import {
  ABILITY_STATUS,
  abilityRows,
  cardName,
  FACTION_META,
  KIND_LABEL,
  passiveLabels,
  TOKEN_KIND,
} from '../lib/card-meta'
import { CARD_FORM, CARD_SIZE, CARD_STATE, frameColor, glowFilter } from '../lib/card-visual'
import EffectChip from './EffectChip.vue'
import EffectText from './EffectText.vue'

/*
 * Внешний вид карты в натуральном размере (200x280 для карточки и рубашки, 280x200 для развёрнутой базы).
 * Масштаб, позицию и поворот задаёт тот, кто размещает карту (CardLayer, окна выбора).
 */
const props = withDefaults(defineProps<{
  /** Рубашка рисуется без cardId. */
  cardId?: string | null
  form?: CardForm
  state?: CardVisualState
  basic?: AbilityStatus
  ally?: AbilityStatus
  scrap?: AbilityStatus
  /** Карта скопировала другой корабль (Stealth Needle): показываются способности копии. */
  copyOf?: string
}>(), {
  copyOf: undefined,
  cardId: null,
  form: CARD_FORM.CARD,
  state: CARD_STATE.IDLE,
  basic: ABILITY_STATUS.AUTO,
  ally: ABILITY_STATUS.AUTO,
  scrap: ABILITY_STATUS.AUTO,
})

const isBack = computed(() => props.form === CARD_FORM.BACK || props.cardId === null)
const isDeployed = computed(() => !isBack.value && props.form === CARD_FORM.DEPLOYED)

const card = computed(() => (props.cardId && !isBack.value ? getCard(props.cardId) : null))
const faction = computed(() => (card.value ? FACTION_META[card.value.faction] : null))
const isOutpost = computed(() => card.value?.kind === CARD_KIND.OUTPOST)
const rows = computed(() => (props.cardId && !isBack.value ? abilityRows(props.copyOf ?? props.cardId) : []))
const passives = computed(() => (props.cardId && !isBack.value ? passiveLabels(props.cardId) : []))

const size = computed(() => (isDeployed.value ? CARD_SIZE.DEPLOYED : CARD_SIZE.CARD))
const frame = computed(() => frameColor(props.state, isBack.value ? '79,216,255' : (faction.value?.rgb ?? '79,216,255')))

const rootStyle = computed(() => ({
  'width': `${size.value.w}px`,
  'height': `${size.value.h}px`,
  'filter': glowFilter(props.state),
  'opacity': props.state === CARD_STATE.DIM ? 0.42 : 1,
  '--frame': frame.value,
  '--f': faction.value?.color ?? '#4FD8FF',
  '--f-rgb': faction.value?.rgb ?? '79,216,255',
}))

const costUnaffordable = computed(() => props.state === CARD_STATE.UNAFFORDABLE)

function statusOf(kind: AbilityKind): AbilityStatus {
  if (kind === ABILITY_KIND.BASIC)
    return props.basic
  return kind === ABILITY_KIND.ALLY ? props.ally : props.scrap
}

const viewRows = computed(() => rows.value.map((row, index) => {
  const status = statusOf(row.kind)
  return {
    ...row,
    first: index === 0,
    status,
    dimmed: status === ABILITY_STATUS.USED || status === ABILITY_STATUS.OFF,
    hasPrefix: row.kind !== ABILITY_KIND.BASIC,
    prefixIsFaction: row.kind === ABILITY_KIND.ALLY,
  }
}))

/** Значок в заглушке картинки; у баз и аванпостов он на 20% крупнее, чем у кораблей. */
const artGlyphSize = computed(() => {
  const ship = isDeployed.value ? 26 : 38
  return card.value?.kind === CARD_KIND.SHIP ? ship : Math.round(ship * 1.2)
})

const kindLabel = computed(() => (card.value ? KIND_LABEL[card.value.kind] : ''))
</script>

<template>
  <div class="card" :class="{ 'card--back': isBack, 'card--deployed': isDeployed }" :style="rootStyle">
    <div class="card__frame" />

    <!-- Рубашка -->
    <div v-if="isBack" class="card__back">
      <div class="card__back-line card__back-line--outer" />
      <div class="card__back-line card__back-line--inner" />
      <AppIcon :name="ICON.LOGO" :size="72" :stroke="0.9" class="card__back-logo" />
    </div>

    <!-- Лицевая сторона -->
    <div v-else-if="card && faction" class="card__body">
      <div class="card__head">
        <template v-if="!isDeployed">
          <div v-if="card.cost > 0" class="card__cost" :class="{ 'card__cost--short': costUnaffordable }">
            {{ card.cost }}
          </div>
          <p class="card__kind">
            {{ kindLabel }}
          </p>
        </template>
        <p v-else class="card__tag" :class="{ 'card__tag--outpost': isOutpost }">
          {{ kindLabel }}
        </p>
        <div v-if="isDeployed" class="card__spacer" />
        <div v-if="card.defense" class="card__defense" :class="{ 'card__defense--outpost': isOutpost }">
          <AppIcon :name="ICON.SHIELD" :size="isDeployed ? 18 : 15" :stroke="1.8" />
          <span>{{ card.defense }}</span>
        </div>
        <AppIcon :path="faction.emblem" :size="20" :stroke="1.8" class="card__emblem" />
      </div>

      <div class="card__title">
        <p class="card__name">
          {{ cardName(card.id) }}
        </p>
        <p class="card__faction">
          {{ faction.label }}
        </p>
      </div>

      <div class="card__art">
        <AppIcon :name="card.kind === CARD_KIND.SHIP ? ICON.SHIP : ICON.BASE" :size="artGlyphSize" :stroke="1.2" class="card__art-glyph" />
        <p v-if="copyOf" class="card__art-caption">
          {{ `КОПИЯ · ${cardName(copyOf)}` }}
        </p>
      </div>

      <div class="card__rows">
        <div
          v-for="row in viewRows"
          :key="row.kind"
          class="card__row"
          :class="[`card__row--${row.status}`, { 'card__row--first': row.first }]"
        >
          <div class="card__row-content" :class="{ 'card__row-content--dim': row.dimmed }">
            <div class="card__row-line">
              <span
                v-if="row.hasPrefix"
                class="card__prefix"
                :class="{ 'card__prefix--faction': row.prefixIsFaction }"
              >
                <AppIcon :path="row.prefixIsFaction ? faction.emblem : undefined" :name="row.prefixIsFaction ? undefined : ICON.SCRAP" :size="17" :stroke="1.9" />
              </span>
              <template v-for="(token, index) in row.chips" :key="index">
                <EffectChip
                  v-if="token.kind === TOKEN_KIND.CHIP"
                  :icon="token.icon"
                  :color="token.color"
                  :rgb="token.rgb"
                  :value="token.value"

                  :label="token.label"
                  :iconless="token.iconless"
                />
                <span v-else-if="token.kind === TOKEN_KIND.OR" class="card__or">ИЛИ</span>
              </template>
              <template v-if="row.chips.length === 0">
                <EffectText v-for="(token, index) in row.texts" :key="index" :token="token" class="card__text" />
              </template>
            </div>
            <template v-if="row.chips.length > 0">
              <EffectText v-for="(token, index) in row.texts" :key="index" :token="token" class="card__text card__text--below" />
            </template>
          </div>
          <AppIcon v-if="row.status === ABILITY_STATUS.USED" :name="ICON.CHECK" :size="13" :stroke="2.6" label="Использовано" class="card__row-mark card__row-mark--used" />
          <AppIcon v-if="row.status === ABILITY_STATUS.READY" :name="ICON.ARROW" :size="13" :stroke="2.6" label="Можно активировать" class="card__row-mark card__row-mark--ready" />
        </div>
        <div v-for="text in passives" :key="text" class="card__row card__row--passive">
          <p class="card__text card__text--below">
            {{ text }}
          </p>
        </div>
      </div>
    </div>

    <!-- Статусные метки -->
    <div v-if="state === CARD_STATE.LOCKED" class="card__locked">
      <AppIcon :name="ICON.SHIELD" :size="38" :stroke="1.5" />
      <p class="card__badge-text">
        ЗА АВАНПОСТОМ
      </p>
    </div>
    <p v-if="state === CARD_STATE.TARGET" class="card__target">
      <AppIcon :name="ICON.COMBAT" :size="14" :stroke="2.4" />
      <span>ЦЕЛЬ</span>
    </p>
    <div v-if="state === CARD_STATE.SELECTED" class="card__selected">
      <AppIcon :name="ICON.CHECK" :size="18" :stroke="2.8" />
    </div>
  </div>
</template>

<style scoped>
.card {
  position: relative;
  flex: none;
  color: var(--c-text);
  font-family: var(--font-text);
  user-select: none;
  --bevel: 16px;
}

.card__frame {
  position: absolute;
  inset: 0;
  background: var(--frame);
  clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
}

.card__body,
.card__back {
  position: absolute;
  inset: 2px;
  clip-path: polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px);
}

.card__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 9px 9px;
  background:
    linear-gradient(180deg, rgba(var(--f-rgb), 0.14) 0%, rgba(11, 18, 34, 0) 42%),
    #0b1222;
}

.card--deployed .card__body {
  gap: 5px;
  padding: 6px 10px;
}

.card__head {
  display: flex;
  flex: none;
  align-items: center;
  gap: 7px;
  height: 26px;
}

.card--deployed .card__head {
  gap: 6px;
  height: 24px;
}

.card__cost {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  background: #ffc23d;
  color: #0a0a0a;
  font: 800 13px/1 var(--font-display);
  clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);
}

.card__cost--short {
  background: #7d8fb5;
  color: #0b1222;
}

.card__kind {
  flex: 1;
  min-width: 0;
  color: var(--c-muted);
  font: 600 10px/1 var(--font-mono);
  letter-spacing: 0.12em;
  white-space: nowrap;
}

.card__tag {
  flex: none;
  padding: 4px 6px;
  color: var(--c-text-quiet);
  font: 700 9px/1 var(--font-mono);
  letter-spacing: 0.14em;
  box-shadow: inset 0 0 0 1px rgba(201, 214, 240, 0.45);
}

.card__tag--outpost {
  background: #e6eeff;
  color: #0b1222;
  box-shadow: inset 0 0 0 1px #e6eeff;
}

.card__spacer {
  flex: 1;
}

.card__defense {
  display: flex;
  flex: none;
  align-items: center;
  gap: 3px;
  height: 22px;
  padding: 0 6px 0 4px;
  background: rgba(230, 238, 255, 0.05);
  color: var(--c-text);
  box-shadow: inset 0 0 0 1px rgba(230, 238, 255, 0.35);
}

.card__defense :deep(svg) {
  fill: none;
}

.card__defense--outpost {
  background: rgba(var(--f-rgb), 0.18);
}

.card__defense--outpost :deep(svg) {
  fill: rgba(var(--f-rgb), 0.45);
}

.card__defense span {
  color: var(--c-text-strong);
  font: 700 12px/1 var(--font-display);
}

.card--deployed .card__defense {
  height: 24px;
  padding: 0 7px 0 4px;
}

.card--deployed .card__defense span {
  font-weight: 800;
  font-size: 15px;
}

.card__emblem {
  color: var(--f);
}

.card__title {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
}

.card__name {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 32px;
  overflow: hidden;
  font: 700 15px/16px var(--font-text);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  text-wrap: balance;
}

.card__faction {
  color: var(--f);
  font: 600 9px/11px var(--font-mono);
  letter-spacing: 0.1em;
  white-space: nowrap;
}

.card__art {
  position: relative;
  display: flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  /* Картинка уступает место тексту: у карт с тремя способностями она сжимается, но не исчезает. */
  min-height: 28px;
  margin: 0 -9px;
  background: repeating-linear-gradient(135deg, rgba(var(--f-rgb), 0.11) 0 7px, rgba(var(--f-rgb), 0.03) 7px 14px);
  border-top: 1px solid rgba(var(--f-rgb), 0.35);
  border-bottom: 1px solid rgba(var(--f-rgb), 0.35);
}

.card--deployed .card__art {
  min-height: 36px;
  margin: 0 -10px;
}

.card__art-glyph {
  color: rgba(var(--f-rgb), 0.75);
}

.card__art-caption {
  position: absolute;
  bottom: 6px;
  left: 9px;
  color: rgba(230, 238, 255, 0.45);
  font: 500 8px/1 var(--font-mono);
  letter-spacing: 0.16em;
}

.card--deployed .card__art-caption {
  bottom: 4px;
  left: 10px;
  font-size: 7px;
}

.card__rows {
  display: flex;
  flex: none;
  flex-direction: column;
}

.card__row {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 3px 12px;
  border-top: 1px solid rgba(230, 238, 255, 0.08);
}

.card__row--first {
  border-top-color: transparent;
}

.card__row-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 100%;
}

.card__row-content--dim {
  opacity: 0.36;
}

.card__row-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.card__prefix {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(201, 214, 240, 0.08);
  color: var(--c-text-quiet);
  box-shadow: inset 0 0 0 1px rgba(201, 214, 240, 0.3);
}

.card__prefix--faction {
  background: rgba(var(--f-rgb), 0.16);
  color: var(--f);
  box-shadow: inset 0 0 0 1px rgba(var(--f-rgb), 0.55);
}

.card__or {
  color: var(--c-muted);
  font: 600 9px/1 var(--font-mono);
  letter-spacing: 0.12em;
}

.card__text {
  min-width: 0;
  color: var(--c-text-quiet);
  /* Exo 2 шире прежнего шрифта: 10.5px, чтобы строки способностей умещались так же, как раньше. */
  font: 500 10.5px/12px var(--font-text);
  text-align: left;
}

.card__text--below {
  width: 100%;
  text-align: center;
  text-wrap: balance;
}

.card__row-mark {
  position: absolute;
  top: 50%;
  right: 1px;
  transform: translateY(-50%);
}

.card__row-mark--used {
  color: var(--c-muted);
}

.card__row-mark--ready {
  color: var(--c-me);
}

.card__back {
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    repeating-linear-gradient(45deg, rgba(79, 216, 255, 0.05) 0 2px, rgba(79, 216, 255, 0) 2px 12px),
    radial-gradient(circle at 50% 50%, #13244c 0%, #0a1122 72%);
}

.card__back-line {
  position: absolute;
}

.card__back-line--outer {
  inset: 12px;
  box-shadow: inset 0 0 0 1px rgba(79, 216, 255, 0.22);
}

.card__back-line--inner {
  inset: 20px;
  box-shadow: inset 0 0 0 1px rgba(79, 216, 255, 0.1);
}

.card__back-logo {
  color: rgba(79, 216, 255, 0.8);
}

.card__locked {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  background: rgba(5, 8, 15, 0.62);
  color: var(--c-text-quiet);
  clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
}

.card__locked :deep(svg) {
  fill: rgba(201, 214, 240, 0.32);
}

.card__badge-text {
  font: 600 10px/1 var(--font-mono);
  letter-spacing: 0.14em;
}

.card__target {
  position: absolute;
  top: -12px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 10px 0 7px;
  background: var(--c-combat);
  color: #1a0605;
  font: 700 10px/1 var(--font-mono);
  letter-spacing: 0.14em;
  white-space: nowrap;
  transform: translateX(-50%);
}

.card__selected {
  position: absolute;
  top: -10px;
  right: -10px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--c-me);
  color: var(--c-me-ink);
  box-shadow: 0 0 0 3px var(--c-bg);
}
</style>
