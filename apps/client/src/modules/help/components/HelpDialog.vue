<script setup lang="ts">
import { computed, ref } from 'vue'
import AppDialog from '@/common/ui/AppDialog.vue'
import ChipGroup from '@/common/ui/ChipGroup.vue'
import GameButton from '@/common/ui/GameButton.vue'
import { IconLegend } from '@/modules/cards'
import { HELP_SECTIONS } from '../lib/help-content'

/** Справка: правила в нескольких разделах и таблица управления. Разделы переключаются кнопками-чипами. */
defineEmits<{ close: [] }>()

const options = HELP_SECTIONS.map(section => ({ value: section.id, label: section.title }))
const chosen = ref<string[]>([HELP_SECTIONS[0]!.id])
const section = computed(() => HELP_SECTIONS.find(item => item.id === chosen.value[0]) ?? HELP_SECTIONS[0]!)
</script>

<template>
  <AppDialog title="Справка" eyebrow="ПРАВИЛА И УПРАВЛЕНИЕ" :width="1000" :max-height="900" closable :z-index="580" @close="$emit('close')">
    <ChipGroup v-model="chosen" label="Разделы справки" :options="options" />

    <article :key="section.id" class="help" :aria-label="section.title">
      <h3 class="help__title">
        {{ section.title }}
      </h3>
      <template v-for="(block, index) in section.blocks" :key="index">
        <p v-if="block.kind === 'text'" class="help__text">
          {{ block.text }}
        </p>
        <ul v-else-if="block.kind === 'list'" class="help__list">
          <li v-for="item in block.items" :key="item">
            {{ item }}
          </li>
        </ul>
        <IconLegend v-else-if="block.kind === 'legend'" />
        <table v-else class="help__keys">
          <tbody>
            <tr v-for="row in block.rows" :key="row.action">
              <th scope="row">
                <kbd v-for="key in row.keys" :key="key">{{ key }}</kbd>
              </th>
              <td>{{ row.action }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </article>

    <template #footer>
      <GameButton :height="52" @click="$emit('close')">
        Понятно
      </GameButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.help {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.help__title {
  margin: 0;
  font: 700 22px/1.2 var(--font-text);
}

.help__text {
  max-width: 820px;
  margin: 0;
  color: var(--c-text-soft);
  font: 400 18px/26px var(--font-text);
}

.help__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 820px;
  margin: 0;
  padding-left: 22px;
  color: var(--c-text-soft);
  font: 400 18px/26px var(--font-text);
}

.help__keys {
  border-collapse: collapse;
  color: var(--c-text-soft);
  font: 400 17px/24px var(--font-text);
}

.help__keys th,
.help__keys td {
  padding: 8px 0;
  border-bottom: 1px solid rgba(143, 163, 200, 0.12);
  vertical-align: top;
}

.help__keys th {
  width: 190px;
  padding-right: 20px;
  font-weight: 400;
  text-align: left;
}

kbd {
  display: inline-block;
  min-width: 30px;
  margin-right: 6px;
  padding: 3px 9px;
  background: var(--c-surface-raised);
  color: var(--c-text-strong);
  font: 600 14px/20px var(--font-mono);
  text-align: center;
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.4);
}
</style>
