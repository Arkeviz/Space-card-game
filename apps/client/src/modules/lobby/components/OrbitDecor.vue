<script setup lang="ts">
import AppIcon from '@/common/ui/AppIcon.vue'
import { ICON } from '@/common/ui/icons'

/** Концентрические «орбиты» с планетами: фон лобби. Центр - в точке (1420, 540) сцены. */
defineProps<{
  /** В ожидании соперника вторая планета пустая: он ещё не пришёл. */
  hollow?: boolean
}>()
</script>

<template>
  <div class="orbit" aria-hidden="true">
    <div class="orbit__ring orbit__ring--outer" />
    <div class="orbit__ring orbit__ring--middle" />
    <div class="orbit__ring orbit__ring--inner" />
    <div class="orbit__planet orbit__planet--cyan" />
    <div class="orbit__planet orbit__planet--violet" :class="{ 'orbit__planet--hollow': hollow }" />
    <div v-if="!hollow" class="orbit__planet orbit__planet--gold" />
    <AppIcon :name="ICON.LOGO" :size="150" :stroke="0.6" class="orbit__logo" />
  </div>
</template>

<style scoped>
.orbit {
  position: absolute;
  top: 540px;
  left: 1420px;
  width: 0;
  height: 0;
  pointer-events: none;
}

.orbit__ring {
  position: absolute;
  border-radius: 50%;
}

.orbit__ring--outer {
  top: -440px;
  left: -440px;
  width: 880px;
  height: 880px;
  box-shadow: inset 0 0 0 1px rgba(79, 216, 255, 0.1);
}

.orbit__ring--middle {
  top: -320px;
  left: -320px;
  width: 640px;
  height: 640px;
  box-shadow: inset 0 0 0 1px rgba(79, 216, 255, 0.16);
}

.orbit__ring--inner {
  top: -200px;
  left: -200px;
  width: 400px;
  height: 400px;
  box-shadow: inset 0 0 0 1px rgba(79, 216, 255, 0.24);
}

.orbit__planet {
  position: absolute;
  border-radius: 50%;
}

.orbit__planet--cyan {
  top: -168px;
  left: 276px;
  width: 12px;
  height: 12px;
  background: var(--c-me);
  box-shadow: 0 0 18px rgba(79, 216, 255, 0.8);
}

.orbit__planet--violet {
  top: 228px;
  left: -337px;
  width: 10px;
  height: 10px;
  background: var(--c-opponent);
  box-shadow: 0 0 16px rgba(179, 156, 255, 0.8);
}

.orbit__planet--hollow {
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--c-opponent);
}

.orbit__planet--gold {
  top: 150px;
  left: 118px;
  width: 8px;
  height: 8px;
  background: var(--c-trade);
  box-shadow: 0 0 12px rgba(255, 194, 61, 0.8);
}

.orbit__logo {
  position: absolute;
  top: -75px;
  left: -75px;
  color: rgba(79, 216, 255, 0.75);
}
</style>
