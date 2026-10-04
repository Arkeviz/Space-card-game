<script setup lang="ts">
import type { FxItem } from '../lib/fx'
import { FX_TONE } from '../lib/fx'

/** Всплывающие числа («+2», «-3»): поднимаются и гаснут. Положение задаёт родитель (position: relative). */
defineProps<{ items: FxItem[] }>()
</script>

<template>
  <span
    v-for="item in items"
    :key="item.id"
    class="fx"
    :class="item.tone === FX_TONE.GAIN ? 'fx--gain' : 'fx--loss'"
    aria-hidden="true"
  >{{ item.text }}</span>
</template>

<style scoped>
.fx {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 5;
  font: 800 26px/1 var(--font-display);
  pointer-events: none;
  text-shadow: 0 0 14px currentcolor;
  animation: fx-rise 1.3s ease-out forwards;
}

.fx--gain {
  color: var(--c-authority);
}

.fx--loss {
  color: var(--c-combat);
}

@keyframes fx-rise {
  0% {
    opacity: 0;
    transform: translateY(8px) scale(0.8);
  }

  15% {
    opacity: 1;
    transform: translateY(0) scale(1.1);
  }

  100% {
    opacity: 0;
    transform: translateY(-34px) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .fx {
    animation-duration: 0.01s;
    animation-delay: 1s;
  }
}
</style>
