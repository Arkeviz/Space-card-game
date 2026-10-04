<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  /** Высота кнопки в px. */
  height?: number
}>(), {
  variant: 'primary',
  height: 56,
})
</script>

<template>
  <button class="game-button" :class="`game-button--${variant}`" type="button" :style="{ height: `${height}px` }">
    <slot />
  </button>
</template>

<style scoped>
.game-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 0;
  padding: 0 24px;
  border: 0;
  cursor: pointer;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 14px;
  line-height: 1;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: filter 0.15s, box-shadow 0.15s;
}

.game-button:disabled {
  cursor: default;
}

.game-button--primary {
  background: var(--c-me);
  color: var(--c-me-ink);
  box-shadow: 0 0 28px rgba(79, 216, 255, 0.3);
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
}

.game-button--primary:hover:not(:disabled) {
  filter: brightness(1.1);
}

.game-button--primary:disabled {
  background: rgba(143, 163, 200, 0.08);
  color: var(--c-dim);
  box-shadow: inset 0 0 0 1px rgba(143, 163, 200, 0.25);
}

.game-button--outline {
  background: transparent;
  color: var(--c-me);
  box-shadow: inset 0 0 0 1px var(--c-me);
}

.game-button--outline:hover:not(:disabled) {
  background: rgba(79, 216, 255, 0.1);
}

.game-button--ghost {
  background: rgba(10, 16, 32, 0.6);
  color: var(--c-text-quiet);
  box-shadow: inset 0 0 0 1px rgba(201, 214, 240, 0.5);
}

.game-button--ghost:hover:not(:disabled) {
  background: rgba(201, 214, 240, 0.1);
}

.game-button--danger {
  background: transparent;
  color: var(--c-combat);
  box-shadow: inset 0 0 0 1px var(--c-combat);
}

.game-button--danger:hover:not(:disabled) {
  background: rgba(255, 90, 79, 0.12);
}
</style>
