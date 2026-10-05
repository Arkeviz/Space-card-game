import { COMMAND_TYPE } from '@space/engine'
import { CLIENT_MESSAGE, HEARTBEAT, MATCH_ERROR, SERVER_MESSAGE } from '@space/protocol'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.ts'

interface MessageSocket {
  send: (data: string) => void
  once: (event: 'message', cb: (data: unknown) => void) => void
  on: (event: 'message', cb: (data: unknown) => void) => void
  terminate: () => void
}

/**
 * Очередь входящих сообщений сокета: подписывается сразу, а не в момент ожидания.
 * Иначе сообщение, отправленное сервером синхронно в ответ на чужое действие
 * (например update при входе соперника), теряется - слушателя ещё нет.
 */
function messageQueue(socket: MessageSocket) {
  const queue: any[] = []
  const waiters: ((value: any) => void)[] = []
  socket.on('message', (data) => {
    const parsed = JSON.parse((data as { toString: () => string }).toString())
    const waiter = waiters.shift()
    if (waiter)
      waiter(parsed)
    else
      queue.push(parsed)
  })
  return {
    next(): Promise<any> {
      if (queue.length > 0)
        return Promise.resolve(queue.shift())
      return new Promise(resolve => waiters.push(resolve))
    },
  }
}

describe('ws heartbeat', () => {
  const app = buildApp({ firstPlayer: 0 })

  afterEach(async () => {
    await app.close()
  })

  it('отвечает pong на ping', async () => {
    await app.ready()
    const socket = await app.injectWS('/ws')
    const reply = new Promise<string>((resolve) => {
      socket.once('message', data => resolve(data.toString()))
    })
    socket.send(HEARTBEAT.PING)
    expect(await reply).toBe(HEARTBEAT.PONG)
    socket.terminate()
  })
})

describe('ws matchmaking: сквозной сценарий через реальный маршрут /ws', () => {
  it('создание, вход по коду, обмен командой и рассылка update обоим игрокам', async () => {
    const app = buildApp({ firstPlayer: 0, turnTimeoutMs: 60_000, disconnectTimeoutMs: 60_000 })
    await app.ready()
    try {
      const creator = await app.injectWS('/ws')
      const joiner = await app.injectWS('/ws')
      const creatorMessages = messageQueue(creator)
      const joinerMessages = messageQueue(joiner)

      creator.send(JSON.stringify({ type: CLIENT_MESSAGE.CREATE_MATCH }))
      const joined0 = await creatorMessages.next()
      expect(joined0).toMatchObject({ type: SERVER_MESSAGE.JOINED, you: 0, opponentConnected: false })

      joiner.send(JSON.stringify({ type: CLIENT_MESSAGE.JOIN_MATCH, code: joined0.code }))
      const joined1 = await joinerMessages.next()
      expect(joined1).toMatchObject({ type: SERVER_MESSAGE.JOINED, you: 1, opponentConnected: true })

      // Создатель сначала узнаёт, что соперник на связи, и только потом получает первый update.
      expect(await creatorMessages.next()).toEqual({ type: SERVER_MESSAGE.OPPONENT_STATUS, connected: true, reconnectTimeLeftMs: null })
      const creatorUpdate = await creatorMessages.next()
      expect(creatorUpdate).toMatchObject({ type: SERVER_MESSAGE.UPDATE, version: 0 })
      const joinerUpdate = await joinerMessages.next()
      expect(joinerUpdate).toMatchObject({ type: SERVER_MESSAGE.UPDATE, version: 0 })

      creator.send(JSON.stringify({ type: CLIENT_MESSAGE.COMMAND, commandId: 'cmd-1', command: { type: COMMAND_TYPE.END_TURN } }))
      const ack = await creatorMessages.next()
      expect(ack).toEqual({ type: SERVER_MESSAGE.ACK, commandId: 'cmd-1' })

      const creatorUpdate2 = await creatorMessages.next()
      const joinerUpdate2 = await joinerMessages.next()
      expect(creatorUpdate2).toMatchObject({ type: SERVER_MESSAGE.UPDATE, version: 1 })
      expect(joinerUpdate2).toMatchObject({ type: SERVER_MESSAGE.UPDATE, version: 1 })

      creator.terminate()
      joiner.terminate()
    }
    finally {
      await app.close()
    }
  })

  it('неверный код входа возвращает ERROR not-found', async () => {
    const app = buildApp({ firstPlayer: 0 })
    await app.ready()
    try {
      const socket = await app.injectWS('/ws')
      const messages = messageQueue(socket)
      socket.send(JSON.stringify({ type: CLIENT_MESSAGE.JOIN_MATCH, code: 'ZZZZZZ' }))
      expect(await messages.next()).toEqual({ type: SERVER_MESSAGE.ERROR, reason: MATCH_ERROR.NOT_FOUND })
      socket.terminate()
    }
    finally {
      await app.close()
    }
  })

  it('команда до входа в матч возвращает ERROR not-in-match', async () => {
    const app = buildApp({ firstPlayer: 0 })
    await app.ready()
    try {
      const socket = await app.injectWS('/ws')
      const messages = messageQueue(socket)
      socket.send(JSON.stringify({ type: CLIENT_MESSAGE.SYNC }))
      expect(await messages.next()).toEqual({ type: SERVER_MESSAGE.ERROR, reason: MATCH_ERROR.NOT_IN_MATCH })
      socket.terminate()
    }
    finally {
      await app.close()
    }
  })

  it('повторное создание матча на уже привязанном сокете возвращает ERROR already-in-match', async () => {
    const app = buildApp({ firstPlayer: 0 })
    await app.ready()
    try {
      const socket = await app.injectWS('/ws')
      const messages = messageQueue(socket)
      socket.send(JSON.stringify({ type: CLIENT_MESSAGE.CREATE_MATCH }))
      await messages.next()
      socket.send(JSON.stringify({ type: CLIENT_MESSAGE.CREATE_MATCH }))
      expect(await messages.next()).toEqual({ type: SERVER_MESSAGE.ERROR, reason: MATCH_ERROR.ALREADY_IN_MATCH })
      socket.terminate()
    }
    finally {
      await app.close()
    }
  })
})
