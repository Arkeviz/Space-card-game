<script setup lang="ts">
/** Показывает окно с обратным отсчётом, как только на сервере появилась новая версия клиента. Подключается один раз в layout. */
import { useAppUpdate } from '../composables/useAppUpdate'
import AppUpdateToast from './AppUpdateToast.vue'

const { available } = useAppUpdate()

function reload(): void {
  window.location.reload()
}
</script>

<template>
  <AppUpdateToast v-if="available" @reload="reload" />
</template>
