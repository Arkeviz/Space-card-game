<script setup lang="ts">
import { computed, provide } from 'vue'
import { useRoute } from 'vue-router'
import AppTooltip from '@/common/ui/AppTooltip.vue'
import AppVersion from '@/common/ui/AppVersion.vue'
import { BACKDROP_ANIMATED_KEY } from '@/common/ui/backdrop-animation'
import { useSettings } from '@/modules/settings'

// Версию показываем на главном экране и на экране матча.
const route = useRoute()
const showVersion = computed(() => route.name === 'lobby' || route.name === 'match')

// Фон экранов зависит от настройки игрока: common его про настройки не знает, поэтому значение передаётся через provide.
const settings = useSettings()
provide(BACKDROP_ANIMATED_KEY, computed(() => settings.value.animatedBackground))
</script>

<template>
  <RouterView />
  <AppTooltip />
  <AppVersion v-if="showVersion" />
</template>
