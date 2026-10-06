<script setup lang="ts">
import AppIcon from '@/common/ui/AppIcon.vue'
import { ICON } from '@/common/ui/icons'
import { FACTION_META } from '../lib/card-meta'
import { ICON_LEGEND, LEGEND_SAMPLE } from '../lib/icon-legend'
import EffectChip from './EffectChip.vue'

/** Условные обозначения: все значки с карт и пояснения к ним. Образцы рисуются теми же компонентами, что и карты. */
const emblems = Object.values(FACTION_META)
</script>

<template>
  <div class="legend">
    <section v-for="group in ICON_LEGEND" :key="group.id" class="group" :aria-label="group.title">
      <h4 class="group__title">
        {{ group.title }}
      </h4>
      <ul class="group__list">
        <li v-for="entry in group.entries" :key="entry.title" class="entry">
          <div class="entry__sample">
            <EffectChip
              v-if="entry.sample.kind === LEGEND_SAMPLE.CHIP"
              large
              :icon="entry.sample.icon"
              :color="entry.sample.color"
              :rgb="entry.sample.rgb"
              :value="entry.sample.value"

              :label="entry.text"
              :iconless="entry.sample.iconless"
            />
            <span v-else-if="entry.sample.kind === LEGEND_SAMPLE.PREFIX" class="prefix">
              <AppIcon :name="entry.sample.icon" :size="22" />
            </span>
            <template v-else-if="entry.sample.kind === LEGEND_SAMPLE.EMBLEMS">
              <span v-for="meta in emblems" :key="meta.label" class="prefix prefix--faction" :style="{ '--f': meta.color, '--f-rgb': meta.rgb }" :data-tip="meta.label">
                <AppIcon :path="meta.emblem" :size="20" :stroke="1.8" />
              </span>
            </template>
            <span v-else-if="entry.sample.kind === LEGEND_SAMPLE.DEFENSE" class="defense">
              <AppIcon :name="ICON.SHIELD" :size="20" :stroke="1.8" />
              <span>5</span>
            </span>
            <AppIcon v-else :name="entry.sample.icon" :size="26" :stroke="2.6" :style="{ color: entry.sample.color }" />
          </div>
          <div class="entry__body">
            <p class="entry__title">
              {{ entry.title }}
            </p>
            <p class="entry__text">
              {{ entry.text }}
            </p>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.legend {
  display: flex;
  flex-direction: column;
  gap: 26px;
}

.group__title {
  margin: 0 0 6px;
  color: var(--c-muted);
  font: 600 13px/1 var(--font-mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.group__list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.entry {
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr);
  gap: 20px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(143, 163, 200, 0.12);
}

.entry__sample {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.entry__title {
  margin: 0 0 2px;
  color: var(--c-text-strong);
  font: 600 18px/24px var(--font-text);
}

.entry__text {
  margin: 0;
  color: var(--c-text-soft);
  font: 400 16px/22px var(--font-text);
}

.prefix {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: rgba(201, 214, 240, 0.08);
  color: var(--c-text-quiet);
  box-shadow: inset 0 0 0 1px rgba(201, 214, 240, 0.3);
}

.prefix--faction {
  width: 32px;
  height: 32px;
  background: rgba(var(--f-rgb), 0.16);
  color: var(--f);
  box-shadow: inset 0 0 0 1px rgba(var(--f-rgb), 0.55);
}

.defense {
  display: flex;
  gap: 4px;
  align-items: center;
  height: 34px;
  padding: 0 10px 0 7px;
  background: rgba(230, 238, 255, 0.05);
  color: var(--c-text);
  box-shadow: inset 0 0 0 1px rgba(230, 238, 255, 0.35);
}

.defense span {
  color: var(--c-text-strong);
  font: 700 17px/1 var(--font-display);
}
</style>
