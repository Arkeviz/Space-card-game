import websocket from '@fastify/websocket'
import { HEARTBEAT, isPing } from '@space/protocol'
import Fastify from 'fastify'

export function buildApp() {
  const app = Fastify()

  app.register(websocket)
  app.register(async (instance) => {
    instance.get('/ws', { websocket: true }, (socket) => {
      socket.on('message', (raw) => {
        // Ответ на heartbeat клиента (useWebSocket).
        if (isPing(raw.toString()))
          socket.send(HEARTBEAT.PONG)
      })
    })
  })

  return app
}
