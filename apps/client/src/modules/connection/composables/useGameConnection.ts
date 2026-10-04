import type { Command } from '@space/engine'
import type { ClientMessage, ServerMessage } from '@space/protocol'
import type { App, ComputedRef, InjectionKey } from 'vue'
import type { CommandResult, UpdateListener } from '../lib/connection-state'
import { CLIENT_MESSAGE, HEARTBEAT } from '@space/protocol'
import { useIntervalFn, useWebSocket } from '@vueuse/core'
import { computed, inject, reactive, watch } from 'vue'
import { ConnectionState } from '../lib/connection-state'

const STORAGE_KEY = 'space-card-game:reconnect'

interface StoredReconnect {
  matchId: string
  token: string
}

function isStoredReconnect(value: unknown): value is StoredReconnect {
  return typeof value === 'object' && value !== null
    && typeof (value as StoredReconnect).matchId === 'string'
    && typeof (value as StoredReconnect).token === 'string'
}

/*
 * Именно sessionStorage, а не localStorage: последний общий на все вкладки одного источника, и вторая
 * вкладка (например, второй игрок за тем же браузером при локальной разработке) автоматически
 * переподключилась бы по чужому токену и перехватила место первой. sessionStorage у каждой вкладки свой.
 */
function readStoredReconnect(): StoredReconnect | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw)
      return null
    const parsed: unknown = JSON.parse(raw)
    return isStoredReconnect(parsed) ? parsed : null
  }
  catch {
    return null
  }
}

function writeStoredReconnect(value: StoredReconnect | null): void {
  try {
    if (value)
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else
      sessionStorage.removeItem(STORAGE_KEY)
  }
  catch {
    // Приватный режим браузера и т. п.: переподключение просто не сохранится между перезагрузками страницы.
  }
}

export interface GameConnection {
  /** Реактивное состояние подключения (view, legalActions, ошибки и т. п.). */
  state: ConnectionState
  status: ReturnType<typeof useWebSocket>['status']
  /** Соединение с сервером открыто. */
  online: ComputedRef<boolean>
  createMatch: () => void
  joinMatch: (code: string) => void
  /** Разрешается ack'ом ({ ok: true }) или reject'ом/разрывом связи ({ ok: false, reason }). */
  submitCommand: (command: Command) => Promise<CommandResult>
  sync: () => void
  /** Покинуть матч и вернуться в состояние лобби. */
  leaveMatch: () => void
  /** Подписка на каждый update с событиями (в отличие от state.view, который хранит только последний). Возвращает отписку. */
  onUpdate: (listener: UpdateListener) => () => void
}

/**
 * Собирает подключение к серверу матчей. wsUrl передаётся параметром (IoC) - модуль не должен читать
 * конфиг приложения напрямую, это нарушило бы границы FEOD (modules не импортирует app).
 */
export function createGameConnection(wsUrl: string): GameConnection {
  const state = reactive(new ConnectionState()) as ConnectionState
  let socket: ReturnType<typeof useWebSocket> | undefined

  function send(message: ClientMessage): void {
    socket?.send(JSON.stringify(message))
  }

  function handleMessage(raw: string): void {
    let message: ServerMessage
    try {
      message = JSON.parse(raw)
    }
    catch {
      return
    }
    const reconnectInfo = state.handleServerMessage(message)
    if (reconnectInfo)
      writeStoredReconnect(reconnectInfo)
  }

  socket = useWebSocket(wsUrl, {
    immediate: true,
    autoReconnect: { retries: 60, delay: 1000 },
    heartbeat: {
      message: HEARTBEAT.PING,
      responseMessage: HEARTBEAT.PONG,
      // useWebSocket не даёт настроить интервал напрямую - только через свой scheduler (по умолчанию раз в секунду).
      scheduler: cb => useIntervalFn(cb, 15_000, { immediate: false }),
      pongTimeout: 5_000,
    },
    onConnected: () => {
      const stored = readStoredReconnect()
      if (stored)
        send({ type: CLIENT_MESSAGE.RECONNECT, matchId: stored.matchId, token: stored.token })
    },
    onMessage: (_ws, event) => handleMessage(event.data as string),
    // Разрыв связи: команды, для которых ack/reject мог не дойти, не должны зависать вечно.
    onDisconnected: () => state.rejectAllPending(),
  })

  watch(() => state.view?.winner, (winner) => {
    if (winner !== null && winner !== undefined)
      writeStoredReconnect(null)
  })

  return {
    state,
    status: socket.status,
    online: computed(() => socket.status.value === 'OPEN'),
    createMatch: () => send({ type: CLIENT_MESSAGE.CREATE_MATCH }),
    joinMatch: code => send({ type: CLIENT_MESSAGE.JOIN_MATCH, code }),
    submitCommand: command => new Promise<CommandResult>((resolve) => {
      const commandId = crypto.randomUUID()
      state.registerPending(commandId, resolve)
      send({ type: CLIENT_MESSAGE.COMMAND, commandId, command })
    }),
    sync: () => send({ type: CLIENT_MESSAGE.SYNC }),
    leaveMatch: () => {
      state.leave()
      writeStoredReconnect(null)
    },
    onUpdate: listener => state.subscribeUpdates(listener),
  }
}

const GAME_CONNECTION_KEY: InjectionKey<GameConnection> = Symbol('game-connection')

/** Вызывается один раз в app/entry.ts - создаёт подключение и делает его доступным через useGameConnection(). */
export function provideGameConnection(app: App, wsUrl: string): GameConnection {
  const connection = createGameConnection(wsUrl)
  app.provide(GAME_CONNECTION_KEY, connection)
  return connection
}

/** Для страниц и модулей: возвращает подключение, заведённое provideGameConnection() в app/entry.ts. */
export function useGameConnection(): GameConnection {
  const connection = inject(GAME_CONNECTION_KEY)
  if (!connection)
    throw new Error('useGameConnection() вызван без provideGameConnection() - должен быть вызван один раз в app/entry.ts')
  return connection
}
