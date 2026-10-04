<script setup lang="ts">
import type { PileViewerItem } from '../lib/pile-items'
import AppDialog from '@/common/ui/AppDialog.vue'
import { cardName, CardThumb } from '@/modules/cards'

/** Просмотр стопки (сброс, свалка, состав колоды): карты лицом вверх, одинаковые собраны в одну со счётчиком. */
defineProps<{
  title: string
  items: PileViewerItem[]
  /** Пояснение под заголовком (например, что порядок карт в колоде скрыт). */
  note?: string
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <AppDialog :title="title" :width="1560" :max-height="1000" closable :z-index="550" @close="emit('close')">
    <p v-if="note" class="note">
      {{ note }}
    </p>
    <p v-if="items.length === 0" class="empty">
      Здесь пока нет карт.
    </p>
    <ul v-else class="cards">
      <li v-for="item in items" :key="item.key" class="item">
        <CardThumb :card-id="item.cardId" :scale="0.95" />
        <span v-if="item.count > 1" class="item__count" aria-hidden="true">×{{ item.count }}</span>
        <span class="visually-hidden">{{ cardName(item.cardId) }}{{ item.count > 1 ? `, ${item.count} шт.` : '' }}</span>
      </li>
    </ul>
  </AppDialog>
</template>

<style scoped>
.note,
.empty {
  margin: 0;
  color: var(--c-text-soft);
  font: 400 16px/22px var(--font-text);
}

.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin: 0;
  padding: 6px 0 0;
  list-style: none;
}

.item {
  position: relative;
}

.item__count {
  position: absolute;
  top: -10px;
  right: -10px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 32px;
  padding: 0 8px;
  background: var(--c-me);
  color: var(--c-me-ink);
  font: 800 16px/1 var(--font-display);
  box-shadow: 0 0 0 3px var(--c-bg);
}
</style>
