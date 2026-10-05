<script setup lang="ts">
import type { Unspent } from '../lib/unspent'
import AppDialog from '@/common/ui/AppDialog.vue'
import AppIcon from '@/common/ui/AppIcon.vue'
import GameButton from '@/common/ui/GameButton.vue'
import { ICON } from '@/common/ui/icons'

/** Предупреждение перед концом хода: осталась атака или торговля, которую ещё можно потратить. */
defineProps<{ unspent: Unspent }>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <AppDialog title="Завершить ход?" eyebrow="НЕ ВСЁ ПОТРАЧЕНО" :width="760" closable :z-index="540" @close="emit('cancel')">
    <p class="lead">
      В конце хода пулы обнуляются. Сейчас вы теряете:
    </p>

    <ul class="pools">
      <li v-if="unspent.combat > 0" class="pool pool--combat">
        <AppIcon :name="ICON.COMBAT" :size="30" :stroke="1.9" />
        <span class="pool__value">{{ unspent.combat }}</span>
        <span class="pool__text">
          <span class="pool__name">АТАКА</span>
          <span class="pool__hint">ещё можно ударить по сопернику или его базе</span>
        </span>
      </li>
      <li v-if="unspent.trade > 0" class="pool pool--trade">
        <AppIcon :name="ICON.TRADE" :size="30" :stroke="1.9" />
        <span class="pool__value">{{ unspent.trade }}</span>
        <span class="pool__text">
          <span class="pool__name">ТОРГОВЛЯ</span>
          <span class="pool__hint">ещё можно купить карту на рынке</span>
        </span>
      </li>
    </ul>

    <template #footer>
      <GameButton :height="52" @click="emit('cancel')">
        Вернуться к ходу
      </GameButton>
      <GameButton variant="ghost" :height="52" @click="emit('confirm')">
        Всё равно завершить
      </GameButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.lead {
  margin: 0;
  color: var(--c-text-soft);
  font: 400 18px/24px var(--font-text);
}

.pools {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pool {
  display: flex;
  gap: 16px;
  align-items: center;
  height: 76px;
  padding: 0 20px;
}

.pool--combat {
  background: rgba(255, 90, 79, 0.08);
  color: var(--c-combat);
  box-shadow: inset 0 0 0 1px rgba(255, 90, 79, 0.4);
}

.pool--trade {
  background: rgba(255, 194, 61, 0.08);
  color: var(--c-trade);
  box-shadow: inset 0 0 0 1px rgba(255, 194, 61, 0.38);
}

.pool__value {
  min-width: 44px;
  font: 800 38px/1 var(--font-display);
  font-variant-numeric: tabular-nums;
}

.pool__text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pool__name {
  font: 600 16px/1 var(--font-mono);
  letter-spacing: 0.14em;
}

.pool__hint {
  color: var(--c-text-quiet);
  font: 400 16px/1 var(--font-text);
}
</style>
