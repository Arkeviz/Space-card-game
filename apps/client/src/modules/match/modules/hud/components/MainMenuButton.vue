<script setup lang="ts">
import AppIcon from '@/common/ui/AppIcon.vue'
import { ICON } from '@/common/ui/icons'

/**
 * Кнопка «в главное меню» после конца матча: красная и пульсирующая, чтобы тот, кто остался смотреть на поле
 * (итоги скрыты), сразу видел, как выйти. Рядом с кнопкой меню матча.
 */
defineEmits<{ click: [] }>()
</script>

<template>
  <button type="button" class="home" aria-label="Вернуться в главное меню" data-tip="Вернуться в главное меню" @click="$emit('click')">
    <AppIcon :name="ICON.HOME" :size="20" :stroke="2" />
  </button>
</template>

<style scoped>
.home {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  background: rgba(40, 10, 14, 0.92);
  color: var(--c-combat);
  box-shadow: inset 0 0 0 1px var(--c-combat);
  cursor: pointer;
  animation: home-pulse 1.6s ease-out infinite;
}

.home:hover {
  background: var(--c-combat);
  color: var(--c-me-ink);
}

.home:focus-visible {
  outline: 2px solid var(--c-text-strong);
  outline-offset: 3px;
}

@keyframes home-pulse {
  0% {
    box-shadow: inset 0 0 0 1px var(--c-combat), 0 0 0 0 rgba(255, 90, 79, 0.6);
  }

  70%,
  100% {
    box-shadow: inset 0 0 0 1px var(--c-combat), 0 0 0 14px rgba(255, 90, 79, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .home {
    animation: none;
  }
}
</style>
