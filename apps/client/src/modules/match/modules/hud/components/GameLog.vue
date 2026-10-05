<script setup lang="ts">
import type { LogEntry } from '../lib/describe'
import { computed } from 'vue'
import { LOG_KIND } from '../lib/describe'

const props = defineProps<{ entries: LogEntry[] }>()

/** Помещается около 20 строк; старые записи уходят за верхний край. */
const VISIBLE = 22
const visible = computed(() => props.entries.slice(-VISIBLE))
const lastItem = computed(() => [...props.entries].reverse().find(entry => entry.kind === LOG_KIND.ITEM) ?? null)
</script>

<template>
  <aside class="log" aria-label="Журнал боя">
    <p class="log__title">
      <span>ЖУРНАЛ БОЯ</span>
      <span class="log__live">LIVE</span>
    </p>
    <ol class="log__list">
      <template v-for="entry in visible" :key="entry.id">
        <li v-if="entry.kind === LOG_KIND.HEAD" class="log__head" :class="entry.mine ? 'log__head--me' : 'log__head--opponent'">
          <span>{{ entry.text }}</span>
          <span class="log__rule" />
        </li>
        <li v-else class="log__item" :class="[entry.mine ? 'log__item--me' : 'log__item--opponent', { 'log__item--latest': entry.id === lastItem?.id }]">
          <span class="log__mark" />
          <span>{{ entry.text }}</span>
        </li>
      </template>
    </ol>
    <!-- Скринридеру достаточно озвучивать только новую запись, а не пересказывать весь журнал. -->
    <div class="visually-hidden" role="log" aria-live="polite">
      {{ lastItem?.text }}
    </div>
  </aside>
</template>

<style scoped>
.log {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  height: 100%;
  padding: 16px 16px 18px;
  overflow: hidden;
  background: rgba(10, 16, 32, 0.78);
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.16);
}

.log__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--c-muted);
  font: 600 10px/1 var(--font-mono);
  letter-spacing: 0.18em;
}

.log__live {
  color: #5d7099;
}

.log__list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 9px;
  justify-content: flex-end;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
}

.log__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font: 600 10px/1 var(--font-mono);
  letter-spacing: 0.14em;
  white-space: nowrap;
}

.log__head--me {
  color: var(--c-me);
}

.log__head--opponent {
  color: var(--c-opponent);
}

.log__rule {
  flex: 1;
  height: 1px;
  background: rgba(143, 163, 200, 0.2);
}

.log__item {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  color: var(--c-text-soft);
  font: 400 13px/17px var(--font-text);
}

.log__item--latest {
  color: var(--c-text-strong);
}

.log__mark {
  flex: none;
  width: 5px;
  height: 5px;
  margin-top: 6px;
  transform: rotate(45deg);
}

.log__item--me .log__mark {
  background: var(--c-me);
}

.log__item--opponent .log__mark {
  background: var(--c-opponent);
}
</style>
