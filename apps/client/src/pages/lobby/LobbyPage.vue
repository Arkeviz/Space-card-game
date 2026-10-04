<script setup lang="ts">
import type { MatchError } from '@space/protocol'
import { MATCH_ERROR } from '@space/protocol'
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameConnection } from '@/modules/connection'
import { LobbyScreen, WaitingScreen } from '@/modules/lobby'

const connection = useGameConnection()
const router = useRouter()

const ERROR_TEXT: Record<MatchError, string> = {
  [MATCH_ERROR.NOT_FOUND]: 'Матч с таким кодом не найден.',
  [MATCH_ERROR.FULL]: 'В этом матче уже двое игроков.',
  [MATCH_ERROR.INVALID_TOKEN]: 'Не удалось вернуться в матч: он уже недоступен.',
  [MATCH_ERROR.NOT_IN_MATCH]: 'Вы не участвуете в матче.',
  [MATCH_ERROR.ALREADY_IN_MATCH]: 'Вы уже в матче.',
}

const connected = computed(() => connection.online.value)
const error = computed(() => (connection.state.lastError ? ERROR_TEXT[connection.state.lastError] : null))
const waiting = computed(() => connection.state.matchId !== null && !connection.state.opponentConnected)

// Игра стартует, как только приходит первый update (оба игрока на месте) - переходим на экран матча.
watch(() => connection.state.view, (view) => {
  if (view && connection.state.matchId)
    router.push(`/match/${connection.state.matchId}`)
})
</script>

<template>
  <WaitingScreen
    v-if="waiting && connection.state.code"
    :code="connection.state.code"
    :connected="connected"
    @cancel="connection.leaveMatch()"
  />
  <LobbyScreen
    v-else
    :connected="connected"
    :error="error"
    @create="connection.createMatch()"
    @join="connection.joinMatch($event)"
  />
</template>
