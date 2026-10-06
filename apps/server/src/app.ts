import type { Command } from '@space/engine'
import type { MatchError, ServerMessage } from '@space/protocol'
import type { FastifyRequest } from 'fastify'
import type { WebSocket } from 'ws'
import type { Limits } from './limits.ts'
import type { MatchManagerOptions } from './match-manager.ts'
import process from 'node:process'
import websocket from '@fastify/websocket'
import { CLIENT_MESSAGE, HEARTBEAT, isPing, MATCH_ERROR, parseClientMessage, SERVER_MESSAGE } from '@space/protocol'
import Fastify from 'fastify'
import { clientKey, DEFAULT_LIMITS, HOUR_MS, TokenBucket } from './limits.ts'
import { MatchManager } from './match-manager.ts'
import { sendText, SOCKET_OPEN } from './socket.ts'

export interface AppOptions extends MatchManagerOptions {
  /** Пределы защиты от перегрузки (limits.ts); не указанные берутся из DEFAULT_LIMITS. */
  limits?: Partial<Limits>
  /**
   * Каким прокси сервер верит в X-Forwarded-For (trustProxy Fastify): адреса, подсети и имена вроде `uniquelocal`
   * через запятую. Без него адрес клиента - адрес TCP-соединения, за nginx это был бы адрес самого nginx.
   */
  trustProxy?: string
}

/** Коды закрытия WebSocket (RFC 6455), которыми сервер обрывает соединение сам. */
const CLOSE_CODE = {
  /** Клиент нарушил правила: слишком частые сообщения. */
  POLICY_VIOLATION: 1008,
  /** Ошибка на сервере при обработке сообщения. Клиент переподключится и получит снимок заново. */
  INTERNAL_ERROR: 1011,
  /** Слишком много соединений (всего или с этого адреса). */
  TRY_AGAIN_LATER: 1013,
} as const

/** Открытое соединение: адрес для лимитов, частота его сообщений и ответил ли он на последний ping. */
interface Peer {
  address: string
  messages: TokenBucket
  alive: boolean
}

function send(socket: WebSocket, message: ServerMessage): void {
  sendText(socket, JSON.stringify(message))
}

function sendError(socket: WebSocket, reason: MatchError): void {
  send(socket, { type: SERVER_MESSAGE.ERROR, reason })
}

function reportError(error: unknown): void {
  process.stderr.write(`Ошибка обработки сообщения: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
}

/** Адрес клиента. У соединений, созданных в тестах через injectWS, настоящего сокета может не быть. */
function addressOf(request: FastifyRequest): string | undefined {
  try {
    return request.ip
  }
  catch {
    return undefined
  }
}

export function buildApp(options: AppOptions = {}) {
  const limits: Limits = { ...DEFAULT_LIMITS, ...options.limits }
  const app = Fastify({ trustProxy: options.trustProxy ?? false })
  const manager = new MatchManager(options)
  const peers = new Map<WebSocket, Peer>()
  const connectionsByAddress = new Map<string, number>()
  const matchStartsByAddress = new Map<string, TokenBucket>()
  let heartbeat: ReturnType<typeof setInterval> | null = null

  /** Новая партия с этого адреса ещё в пределах лимита (каждая партия - записи в базе). */
  function allowMatchStart(address: string): boolean {
    if (limits.matchStartsPerHour <= 0)
      return true
    const now = Date.now()
    let bucket = matchStartsByAddress.get(address)
    if (!bucket) {
      bucket = new TokenBucket(limits.matchStartBurst, limits.matchStartsPerHour / HOUR_MS, now)
      matchStartsByAddress.set(address, bucket)
    }
    return bucket.take(now)
  }

  /** Ping всем соединениям; кто не ответил на прошлый, закрывается (вкладку закрыли без закрытия сокета, пропала сеть). */
  function checkPeers(): void {
    for (const [socket, peer] of peers) {
      if (!peer.alive) {
        socket.terminate()
        continue
      }
      peer.alive = false
      socket.ping()
    }
    // Полные вёдра ничего не ограничивают: записи о давно не создававших партии адресах удаляются.
    const now = Date.now()
    for (const [address, bucket] of matchStartsByAddress) {
      if (bucket.isFull(now))
        matchStartsByAddress.delete(address)
    }
  }

  function handleMessage(socket: WebSocket, peer: Peer, text: string): void {
    // Ответ на heartbeat клиента (useWebSocket). Проверяется до JSON.parse - это не JSON-сообщение.
    if (isPing(text)) {
      sendText(socket, HEARTBEAT.PONG)
      return
    }

    const message = parseClientMessage(text)
    if (!message)
      return

    // За каким местом закреплён сокет, определяет менеджер: при поиске и реванше оно меняется само.
    const binding = manager.bindingOf(socket)

    switch (message.type) {
      case CLIENT_MESSAGE.CREATE_MATCH:
      case CLIENT_MESSAGE.JOIN_MATCH:
      case CLIENT_MESSAGE.FIND_MATCH:
      case CLIENT_MESSAGE.RECONNECT: {
        if (binding) {
          sendError(socket, MATCH_ERROR.ALREADY_IN_MATCH)
          return
        }
        if (message.type !== CLIENT_MESSAGE.RECONNECT && !allowMatchStart(peer.address)) {
          // Клиент показывает экран поиска, не дожидаясь ответа: он должен узнать, что в очередь не поставлен.
          if (message.type === CLIENT_MESSAGE.FIND_MATCH)
            send(socket, { type: SERVER_MESSAGE.SEARCH_STATUS, searching: false })
          sendError(socket, MATCH_ERROR.RATE_LIMITED)
          return
        }
        if (message.type === CLIENT_MESSAGE.CREATE_MATCH) {
          manager.createMatch(socket, message.name)
        }
        else if (message.type === CLIENT_MESSAGE.FIND_MATCH) {
          manager.findMatch(socket, message.name)
        }
        else {
          const result = message.type === CLIENT_MESSAGE.JOIN_MATCH
            ? manager.joinMatch(socket, message.code, message.name)
            : manager.reconnect(socket, message.matchId, message.token)
          if ('error' in result)
            sendError(socket, result.error)
        }
        return
      }

      case CLIENT_MESSAGE.CANCEL_SEARCH:
        manager.cancelSearch(socket)
        return

      case CLIENT_MESSAGE.LEAVE_MATCH:
        manager.leaveMatch(socket)
        return

      case CLIENT_MESSAGE.REMATCH:
      case CLIENT_MESSAGE.COMMAND:
      case CLIENT_MESSAGE.SYNC: {
        if (!binding) {
          sendError(socket, MATCH_ERROR.NOT_IN_MATCH)
          return
        }
        if (message.type === CLIENT_MESSAGE.REMATCH) {
          if (allowMatchStart(peer.address))
            manager.requestRematch(socket)
          else
            sendError(socket, MATCH_ERROR.RATE_LIMITED)
        }
        else if (message.type === CLIENT_MESSAGE.COMMAND) {
          manager.submitCommand(binding.room, binding.seat, message.commandId, message.command as Command, socket)
        }
        else {
          manager.sync(binding.room, binding.seat)
        }
      }
    }
  }

  // Партии, которые шли до остановки сервера, поднимаются из хранилища до приёма соединений.
  app.addHook('onReady', async () => {
    await manager.restore()
    heartbeat = setInterval(checkPeers, limits.heartbeatIntervalMs)
    heartbeat.unref()
  })
  // buildApp владеет хранилищем: при остановке сначала дописываются очереди записей, потом закрывается подключение.
  app.addHook('onClose', async () => {
    if (heartbeat)
      clearInterval(heartbeat)
    await manager.dispose()
    await options.repository?.close()
  })
  // Для проверки живости (healthcheck в docker-compose).
  app.get('/health', async () => ({ status: 'ok' }))
  // Больше maxPayload ws сам закрывает соединение (код 1009), не собирая сообщение целиком.
  app.register(websocket, { options: { maxPayload: limits.maxMessageBytes } })
  app.register(async (instance) => {
    instance.get('/ws', { websocket: true }, (socket, request) => {
      const address = clientKey(addressOf(request))
      const fromAddress = connectionsByAddress.get(address) ?? 0
      if (peers.size >= limits.maxConnections || (limits.maxConnectionsPerIp > 0 && fromAddress >= limits.maxConnectionsPerIp)) {
        socket.close(CLOSE_CODE.TRY_AGAIN_LATER)
        return
      }
      connectionsByAddress.set(address, fromAddress + 1)
      const peer: Peer = { address, messages: new TokenBucket(limits.messageBurst, limits.messagesPerSecond / 1000, Date.now()), alive: true }
      peers.set(socket, peer)

      socket.on('pong', () => {
        peer.alive = true
      })

      socket.on('message', (raw) => {
        // После close ws ещё может доставить уже принятые сообщения.
        if (socket.readyState !== SOCKET_OPEN)
          return
        if (!peer.messages.take(Date.now())) {
          socket.close(CLOSE_CODE.POLICY_VIOLATION)
          return
        }
        // Исключение в обработчике событий ws уронило бы весь процесс со всеми партиями: закрывается только этот сокет.
        try {
          handleMessage(socket, peer, raw.toString())
        }
        catch (error) {
          reportError(error)
          socket.close(CLOSE_CODE.INTERNAL_ERROR)
        }
      })

      socket.on('close', () => {
        peers.delete(socket)
        const left = (connectionsByAddress.get(address) ?? 1) - 1
        if (left > 0)
          connectionsByAddress.set(address, left)
        else
          connectionsByAddress.delete(address)
        try {
          manager.handleClose(socket)
        }
        catch (error) {
          reportError(error)
        }
      })
    })
  })

  return app
}
