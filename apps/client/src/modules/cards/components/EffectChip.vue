<script setup lang="ts">
import type { IconName } from '@/common/ui/icons'
import AppIcon from '@/common/ui/AppIcon.vue'

/**
 * Значок эффекта: иконка и необязательное число в рамке цвета ресурса. Используется на картах и в справке.
 * label - описание словами: подсказка при наведении (data-tip читает AppTooltip) и подпись для скринридера.
 */
withDefaults(defineProps<{
  icon: IconName
  color: string
  rgb: string
  value?: string
  label?: string
  /** Крупный вариант для справки. */
  large?: boolean
  /** Только число в цветной рамке, без иконки: так выглядят торговля, атака и авторитет. */
  iconless?: boolean
}>(), {
  value: undefined,
  label: undefined,
})
</script>

<template>
  <span
    class="chip"
    :class="{ 'chip--large': large, 'chip--bare': value === undefined }"
    :style="{ '--chip': color, '--chip-rgb': rgb }"
    :data-tip="label"
    :role="label ? 'img' : undefined"
    :aria-label="label"
  >
    <AppIcon v-if="!iconless" :name="icon" :size="large ? (value === undefined ? 28 : 24) : (value === undefined ? 20 : 16)" :stroke="large ? 1.9 : 2" />
    <span v-if="value !== undefined" class="chip__value">{{ value }}</span>
  </span>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 7px 0 5px;
  background: rgba(var(--chip-rgb), 0.14);
  color: var(--chip);
  box-shadow: inset 0 0 0 1px rgba(var(--chip-rgb), 0.6);
}

.chip--bare {
  padding: 0 5px;
}

.chip__value {
  color: var(--c-text-strong);
  font: 700 13px/1 var(--font-display);
}

.chip--large {
  gap: 6px;
  height: 38px;
  padding: 0 11px 0 8px;
}

.chip--large.chip--bare {
  padding: 0 8px;
}

.chip--large .chip__value {
  font-size: 19px;
}
</style>
