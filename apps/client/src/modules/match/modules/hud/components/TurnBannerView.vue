<script setup lang="ts">
import type { TurnBanner } from '../lib/fx'

/** Крупная надпись при смене хода. Появляется и гаснет сама, ввод не перехватывает. */
defineProps<{ banner: TurnBanner | null }>()
</script>

<template>
  <p v-if="banner" :key="banner.id" class="banner" :class="banner.mine ? 'banner--me' : 'banner--opponent'" aria-hidden="true">
    <span class="banner__text">{{ banner.text }}</span>
  </p>
</template>

<style scoped>
.banner {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 350;
  pointer-events: none;
  transform: translate(-50%, -50%);
  animation: banner-pass 1.5s ease-in-out forwards;
}

.banner__text {
  display: block;
  padding: 18px 56px;
  background: rgba(6, 10, 20, 0.86);
  font: 800 54px/1 var(--font-display);
  letter-spacing: 0.04em;
  text-shadow: 0 0 40px currentcolor;
}

.banner--me {
  color: var(--c-me);
}

.banner--me .banner__text {
  box-shadow: inset 0 0 0 1px rgba(79, 216, 255, 0.5);
}

.banner--opponent {
  color: var(--c-opponent);
}

.banner--opponent .banner__text {
  box-shadow: inset 0 0 0 1px rgba(179, 156, 255, 0.5);
}

@keyframes banner-pass {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.92);
  }

  20%,
  70% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.04);
  }
}

@media (prefers-reduced-motion: reduce) {
  .banner {
    animation-name: none;
  }
}
</style>
