import type { Command } from '@space/engine'
import type { MatchError } from '@space/protocol'
import type { WebSocket } from 'ws'
import type { MatchManagerOptions } from './match-manager.ts'
import websocket from '@fastify/websocket'
import { CLIENT_MESSAGE, HEARTBEAT, isPing, MATCH_ERROR, parseClientMessage, SERVER_MESSAGE } from '@space/protocol'
import Fastify from 'fastify'
import { MatchManager } from './match-manager.ts'

function sendError(socket: WebSocket, reason: MatchError): void {
  socket.send(JSON.stringify({ type: SERVER_MESSAGE.ERROR, reason }))
}

export function buildApp(matchManagerOptions?: MatchManagerOptions) {
  const app = Fastify()
  const manager = new MatchManager(matchManagerOptions)

  // Партии, которые шли до остановки сервера, поднимаются из хранилища до приёма соединений.
  app.addHook('onReady', async () => {
    await manager.restore()
  })
  // buildApp владеет хранилищем: при остановке сначала дописываются очереди записей, потом закрывается подключение.
  app.addHook('onClose', async () => {
    await manager.dispose()
    await matchManagerOptions?.repository?.close()
  })
  // Для проверки живости (healthcheck в docker-compose).
  app.get('/health', async () => ({ status: 'ok' }))
  app.register(websocket)
  app.register(async (instance) => {
    instance.get('/ws', { websocket: true }, (socket) => {
      socket.on('message', (raw) => {
        const text = raw.toString()
        // Ответ на heartbeat клиента (useWebSocket). Проверяется до JSON.parse - это не JSON-сообщение.
        if (isPing(text)) {
          socket.send(HEARTBEAT.PONG)
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
            if (message.type === CLIENT_MESSAGE.REMATCH)
              manager.requestRematch(socket)
            else if (message.type === CLIENT_MESSAGE.COMMAND)
              manager.submitCommand(binding.room, binding.seat, message.commandId, message.command as Command, socket)
            else
              manager.sync(binding.room, binding.seat)
          }
        }
      })

      socket.on('close', () => manager.handleClose(socket))
    })
  })

  return app
}
