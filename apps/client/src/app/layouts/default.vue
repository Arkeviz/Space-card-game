<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppTooltip from '@/common/ui/AppTooltip.vue'
import AppVersion from '@/common/ui/AppVersion.vue'

// Версию показываем на главном экране и на экране матча.
const route = useRoute()
const showVersion = computed(() => route.name === 'lobby' || route.name === 'match')
</script>

<template>
  <RouterView />
  <AppTooltip />
  <AppVersion v-if="showVersion" />
</template>
