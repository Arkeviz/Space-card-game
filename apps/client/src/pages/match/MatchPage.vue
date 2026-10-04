<script setup lang="ts">
/*
 * Страница матча: сопоставляет подключение к серверу и экран матча. Модуль match не знает про connection,
 * поэтому здесь собирается MatchTransport (IoC).
 */
import type { MatchTransport } from '@/modules/match'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameConnection } from '@/modules/connection'
import { MatchScreen } from '@/modules/match'

const connection = useGameConnection()
const router = useRouter()

const ready = computed(() => connection.state.view !== null)

const transport: MatchTransport = {
  snapshot() {
    const { view, legalActions, turnTimeLeftMs, updatedAt } = connection.state
    if (!view)
      return null
    // update пришёл какое-то время назад: оставшееся время уменьшаем на прошедшее.
    const left = turnTimeLeftMs === null ? null : Math.max(0, turnTimeLeftMs - (Date.now() - updatedAt))
    return { version: view.version, events: [], view, legalActions, turnTimeLeftMs: left, receivedAt: Date.now() }
  },
  onUpdate: listener => connection.onUpdate(listener),
  submitCommand: command => connection.submitCommand(command),
}

// Страницу открыли напрямую (перезагрузка, закладка), а переподключаться не к чему - возвращаем в лобби.
const GIVE_UP_MS = 5000
let giveUpTimer: ReturnType<typeof setTimeout> | undefined
onMounted(() => {
  giveUpTimer = setTimeout(() => {
    if (!ready.value)
      router.replace('/')
  }, GIVE_UP_MS)
})
onBeforeUnmount(() => clearTimeout(giveUpTimer))

function leave(): void {
  connection.leaveMatch()
  router.push('/')
}
</script>

<template>
  <MatchScreen v-if="ready" :transport="transport" :online="connection.online.value" @leave="leave" />
  <main v-else class="loading" role="status">
    Загрузка матча…
  </main>
</template>

<style scoped>
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--c-muted);
  font: 600 14px/1 var(--font-mono);
  letter-spacing: 0.2em;
}
</style>
