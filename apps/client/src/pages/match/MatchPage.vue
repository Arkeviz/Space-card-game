<script setup lang="ts">
/*
 * Временная страница для сквозной проверки протокола (сервер <-> connection <-> UI).
 * Настоящее поле с CardLayer/AnimationDirector - следующий шаг этапа 4, эта версия его заменит.
 */
import type { Command } from '@space/engine'
import { COMMAND_TYPE } from '@space/engine'
import { useGameConnection } from '@/modules/connection'

const connection = useGameConnection()

function describeCommand(command: Command): string {
  switch (command.type) {
    case COMMAND_TYPE.PLAY_CARD: return `Сыграть ${command.cardId}`
    case COMMAND_TYPE.BUY: return `Купить ${command.cardId}`
    case COMMAND_TYPE.BUY_EXPLORER: return 'Купить Исследователя'
    case COMMAND_TYPE.ACTIVATE: return `Активировать ${command.cardId} (${command.ability})`
    case COMMAND_TYPE.ATTACK_PLAYER: return `Атаковать игрока (${command.amount})`
    case COMMAND_TYPE.ATTACK_BASE: return `Атаковать базу ${command.cardId}`
    case COMMAND_TYPE.CHOOSE_OPTION: return `Выбрать вариант ${command.index}`
    case COMMAND_TYPE.CHOOSE_CARD: return `Выбрать карту ${command.cardId}`
    case COMMAND_TYPE.SKIP: return 'Пропустить'
    case COMMAND_TYPE.END_TURN: return 'Закончить ход'
    case COMMAND_TYPE.CONCEDE: return 'Сдаться'
  }
}

async function run(command: Command): Promise<void> {
  const result = await connection.submitCommand(command)
  if (!result.ok)
    console.error('Команда отклонена:', result.reason)
}
</script>

<template>
  <main v-if="connection.state.view">
    <h1>Матч</h1>
    <p>Вы - игрок {{ connection.state.you }}. Ход: {{ connection.state.view.turn }}, сейчас ходит {{ connection.state.view.currentPlayer }}.</p>
    <p>Авторитет: вы {{ connection.state.view.self.authority }} / соперник {{ connection.state.view.opponent.authority }}</p>
    <p>Пулы: торговля {{ connection.state.view.pools.trade }}, атака {{ connection.state.view.pools.combat }}</p>

    <p v-if="connection.state.view.winner !== null">
      Игра окончена. Победил игрок {{ connection.state.view.winner }}.
    </p>

    <section>
      <h2>Рука</h2>
      <ul>
        <li v-for="card in connection.state.view.self.hand" :key="card.id">
          {{ card.cardId }} ({{ card.id }})
        </li>
      </ul>
    </section>

    <section>
      <h2>Торговый ряд</h2>
      <ul>
        <li v-for="(card, index) in connection.state.view.tradeRow" :key="index">
          {{ card ? `${card.cardId} (${card.id})` : 'пусто' }}
        </li>
      </ul>
    </section>

    <section>
      <h2>Доступные действия</h2>
      <ul>
        <li v-for="(action, index) in connection.state.legalActions" :key="index">
          <button type="button" @click="run(action)">
            {{ describeCommand(action) }}
          </button>
        </li>
      </ul>
    </section>
  </main>
  <main v-else>
    <p>Загрузка матча…</p>
  </main>
</template>
