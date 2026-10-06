<script setup lang="ts">
import type { EffectToken } from '../lib/card-meta'
import AppIcon from '@/common/ui/AppIcon.vue'
import { TOKEN_KIND } from '../lib/card-meta'

/** Текст способности на карте: предложение (иконка необязательна) или строка из слов и иконок. Шрифт задаёт родитель. */
defineProps<{ token: EffectToken }>()
</script>

<template>
  <span v-if="token.kind === TOKEN_KIND.TEXT">
    <AppIcon v-if="token.icon" :name="token.icon" :size="13" class="icon" />{{ token.label }}
  </span>
  <span v-else-if="token.kind === TOKEN_KIND.LINE" class="line" :data-tip="token.label" role="img" :aria-label="token.label">
    <template v-for="(part, index) in token.parts" :key="index">
      <AppIcon v-if="'icon' in part" :name="part.icon" :size="15" :stroke="2" class="line__icon" />
      <template v-else>
        {{ part.text }}
      </template>
    </template>
  </span>
</template>

<style scoped>
.icon {
  display: inline-block;
  margin-right: 4px;
  vertical-align: -2px;
}

.line {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 3px;
  align-items: center;
  justify-content: center;
  color: var(--c-text);
  font-weight: 600;
}

.line__icon {
  color: #d7e2fa;
}
</style>
