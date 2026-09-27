<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameConnection } from '@/modules/connection'

const connection = useGameConnection()
const router = useRouter()

const joinCode = ref('')

const hasMatch = computed(() => connection.state.matchId !== null)
const isWaitingForOpponent = computed(() => hasMatch.value && !connection.state.opponentConnected)

function createMatch(): void {
  connection.createMatch()
}

function joinMatch(): void {
  if (joinCode.value.trim())
    connection.joinMatch(joinCode.value.trim())
}

// Игра стартует, как только приходит первый update (оба игрока на месте) - переходим на экран матча.
watch(() => connection.state.view, (view) => {
  if (view && connection.state.matchId)
    router.push(`/match/${connection.state.matchId}`)
})
</script>

<template>
  <main>
    <h1>Звёздные империи</h1>
    <p>Статус подключения: {{ connection.status.value }}</p>

    <p v-if="connection.state.lastError">
      Ошибка: {{ connection.state.lastError }}
    </p>

    <section v-if="!hasMatch">
      <button type="button" @click="createMatch">
        Создать матч
      </button>

      <form @submit.prevent="joinMatch">
        <label for="join-code">
          Код матча
          <input id="join-code" v-model="joinCode" type="text" maxlength="6" placeholder="ABC123">
        </label>
        <button type="submit">
          Войти
        </button>
      </form>
    </section>

    <section v-else-if="isWaitingForOpponent">
      <p>Код для второго игрока: <strong>{{ connection.state.code }}</strong></p>
      <p>Ждём подключения соперника…</p>
    </section>
  </main>
</template>
