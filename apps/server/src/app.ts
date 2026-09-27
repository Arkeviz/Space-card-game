import type { Command, PlayerId } from '@space/engine'
import type { MatchError } from '@space/protocol'
import type { WebSocket } from 'ws'
import type { MatchManagerOptions, Room } from './match-manager.ts'
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

  app.register(websocket)
  app.register(async (instance) => {
    instance.get('/ws', { websocket: true }, (socket) => {
      let room: Room | null = null
      let seat: PlayerId | null = null

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

        if (message.type === CLIENT_MESSAGE.CREATE_MATCH || message.type === CLIENT_MESSAGE.JOIN_MATCH || message.type === CLIENT_MESSAGE.RECONNECT) {
          if (room) {
            sendError(socket, MATCH_ERROR.ALREADY_IN_MATCH)
            return
          }
          const result = message.type === CLIENT_MESSAGE.CREATE_MATCH
            ? manager.createMatch(socket)
            : message.type === CLIENT_MESSAGE.JOIN_MATCH
              ? manager.joinMatch(socket, message.code)
              : manager.reconnect(socket, message.matchId, message.token)
          if ('error' in result) {
            sendError(socket, result.error)
            return
          }
          room = result.room
          seat = result.seat
          return
        }

        if (!room || seat === null) {
          sendError(socket, MATCH_ERROR.NOT_IN_MATCH)
          return
        }

        if (message.type === CLIENT_MESSAGE.COMMAND)
          manager.submitCommand(room, seat, message.commandId, message.command as Command, socket)
        else if (message.type === CLIENT_MESSAGE.SYNC)
          manager.sync(room, seat)
      })

      socket.on('close', () => {
        if (room && seat !== null)
          manager.handleDisconnect(room, seat)
      })
    })
  })

  return app
}
