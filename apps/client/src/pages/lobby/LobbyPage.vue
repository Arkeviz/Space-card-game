<script setup lang="ts">
import type { MatchError } from '@space/protocol'
import { DEFAULT_PLAYER_NAMES, MATCH_ERROR } from '@space/protocol'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameConnection } from '@/modules/connection'
import { HelpDialog } from '@/modules/help'
import { LobbyScreen, WaitingScreen } from '@/modules/lobby'
import { cleanPlayerName, SettingsDialog, useSettings } from '@/modules/settings'

const connection = useGameConnection()
const router = useRouter()
const settings = useSettings()
// Пустое имя сервер заменит именем по умолчанию.
const playerName = (): string => cleanPlayerName(settings.value.playerName)
const settingsOpen = ref(false)
const helpOpen = ref(false)

const ERROR_TEXT: Record<MatchError, string> = {
  [MATCH_ERROR.NOT_FOUND]: 'Матч с таким кодом не найден.',
  [MATCH_ERROR.FULL]: 'В этом матче уже двое игроков.',
  [MATCH_ERROR.INVALID_TOKEN]: 'Не удалось вернуться в матч: он уже недоступен.',
  [MATCH_ERROR.NOT_IN_MATCH]: 'Вы не участвуете в матче.',
  [MATCH_ERROR.ALREADY_IN_MATCH]: 'Вы уже в матче.',
  [MATCH_ERROR.EXPIRED]: 'Матч закрыт: соперник так и не подключился.',
  [MATCH_ERROR.RATE_LIMITED]: 'Слишком много матчей за короткое время. Попробуйте через пару минут.',
}

const connected = computed(() => connection.online.value)
const error = computed(() => (connection.state.lastError ? ERROR_TEXT[connection.state.lastError] : null))
const searching = computed(() => connection.state.searching)
// Создатель ждёт, пока кто-то войдёт по коду, либо идёт быстрый поиск (кода у него нет).
const waiting = computed(() => searching.value || (connection.state.matchId !== null && !connection.state.opponentConnected))

// Игра стартует, как только приходит первый update (оба игрока на месте) - переходим на экран матча.
watch(() => connection.state.view, (view) => {
  if (view && connection.state.matchId)
    router.push(`/match/${connection.state.matchId}`)
})

function cancelWaiting(): void {
  if (searching.value)
    connection.cancelSearch()
  else
    connection.leaveMatch()
}
</script>

<template>
  <WaitingScreen
    v-if="waiting"
    :code="searching ? null : connection.state.code"
    :connected="connected"
    @cancel="cancelWaiting"
  />
  <LobbyScreen
    v-else
    v-model:name="settings.playerName"
    :default-name="DEFAULT_PLAYER_NAMES.join(' или ')"
    :connected="connected"
    :error="error"
    @quick="connection.findMatch(playerName())"
    @create="connection.createMatch(playerName())"
    @join="connection.joinMatch($event, playerName())"
    @catalog="router.push('/cards')"
    @settings="settingsOpen = true"
    @help="helpOpen = true"
  >
    <SettingsDialog v-if="settingsOpen" @close="settingsOpen = false" />
    <HelpDialog v-if="helpOpen" @close="helpOpen = false" />
  </LobbyScreen>
</template>
