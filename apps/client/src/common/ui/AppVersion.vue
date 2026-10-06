<script setup lang="ts">
/** Версия приложения в правом нижнем углу окна: берётся из package.json клиента при сборке. */
const version = __APP_VERSION__
</script>

<template>
  <p class="version" aria-label="Версия приложения">
    v{{ version }}
  </p>
</template>

<style scoped>
/* Над сценой, но под окнами; не перехватывает клики. Мелкий и приглушённый, чтобы не мешать панелям у края сцены. */
.version {
  position: fixed;
  right: 10px;
  bottom: 3px;
  z-index: 5;
  margin: 0;
  color: var(--c-muted);
  font: 500 11px/14px var(--font-mono);
  letter-spacing: 0.08em;
  opacity: 0.7;
  pointer-events: none;
  user-select: none;
}
</style>
