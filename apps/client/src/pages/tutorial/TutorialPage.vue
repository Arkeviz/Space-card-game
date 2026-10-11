<script setup lang="ts">
import { useRouter } from 'vue-router'
import { cleanPlayerName, useSettings } from '@/modules/settings'
import { TutorialScreen } from '@/modules/tutorial'

const router = useRouter()
const settings = useSettings()
</script>

<template>
  <TutorialScreen :player-name="cleanPlayerName(settings.playerName) || 'Вы'" @leave="router.push('/')" />
</template>
