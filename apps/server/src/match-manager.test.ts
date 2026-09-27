import type { ServerMessage } from '@space/protocol'
import { COMMAND_TYPE } from '@space/engine'
import { MATCH_ERROR, SERVER_MESSAGE } from '@space/protocol'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatchManager } from './match-manager.ts'

/** Заглушка WebSocket: не поднимает реальную сеть, просто копит отправленные сообщения. */
class FakeSocket {
  readyState = 1
  readonly sent: ServerMessage[] = []
  send(data: string): void {
    this.sent.push(JSON.parse(data))
  }

  lastOf<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }> {
    const message = [...this.sent].reverse().find(m => m.type === type)
    if (!message)
      throw new Error(`Сообщение типа ${type} не отправлено. Отправлены: ${this.sent.map(m => m.type).join(', ')}`)
    return message as Extract<ServerMessage, { type: T }>
  }
}

function fakeSocket() {
  return new FakeSocket() as unknown as Parameters<MatchManager['createMatch']>[0]
}

describe('matchManager: создание и вход по коду', () => {
  it('создатель получает код и место 0, opponentConnected: false', () => {
    const manager = new MatchManager()
    const socket = fakeSocket()
    const { room, seat } = manager.createMatch(socket)
    expect(seat).toBe(0)
    const joined = (socket as unknown as FakeSocket).lastOf(SERVER_MESSAGE.JOINED)
    expect(joined).toMatchObject({ matchId: room.id, code: room.code, you: 0, opponentConnected: false })
    expect(room.state).toBeNull()
  })

  it('вход по неверному коду - ошибка not-found', () => {
    const manager = new MatchManager()
    manager.createMatch(fakeSocket())
    const joiner = fakeSocket()
    const result = manager.joinMatch(joiner, 'ZZZZZZ')
    expect(result).toEqual({ error: MATCH_ERROR.NOT_FOUND })
  })

  it('вход по верному коду (без учёта регистра): место 1, партия создаётся, оба получают update', () => {
    const manager = new MatchManager()
    const creatorSocket = fakeSocket()
    const { room } = manager.createMatch(creatorSocket)
    const joinerSocket = fakeSocket()

    const result = manager.joinMatch(joinerSocket, room.code.toLowerCase())
    expect('error' in result).toBe(false)
    expect(room.state).not.toBeNull()

    const joined = (joinerSocket as unknown as FakeSocket).lastOf(SERVER_MESSAGE.JOINED)
    expect(joined).toMatchObject({ you: 1, opponentConnected: true })

    const creatorUpdate = (creatorSocket as unknown as FakeSocket).lastOf(SERVER_MESSAGE.UPDATE)
    const joinerUpdate = (joinerSocket as unknown as FakeSocket).lastOf(SERVER_MESSAGE.UPDATE)
    expect(creatorUpdate.events).toEqual([])
    expect(joinerUpdate.view.you).toBe(1)
    expect(creatorUpdate.view.you).toBe(0)
  })

  it('третий не может войти в уже заполненный матч', () => {
    const manager = new MatchManager()
    const { room } = manager.createMatch(fakeSocket())
    manager.joinMatch(fakeSocket(), room.code)
    const result = manager.joinMatch(fakeSocket(), room.code)
    expect(result).toEqual({ error: MATCH_ERROR.FULL })
  })
})

describe('matchManager: команды', () => {
  function setupMatch() {
    const manager = new MatchManager()
    const socket0 = fakeSocket()
    const { room } = manager.createMatch(socket0)
    const socket1 = fakeSocket()
    manager.joinMatch(socket1, room.code)
    return { manager, room, socket0, socket1 }
  }

  it('допустимая команда: ACK отправителю, UPDATE обоим с версией и урезанными событиями', () => {
    const { manager, room, socket0, socket1 } = setupMatch()
    const versionBefore = room.state!.version

    manager.submitCommand(room, 0, 'cmd-1', { type: COMMAND_TYPE.END_TURN }, socket0 as unknown as Parameters<MatchManager['createMatch']>[0])

    const ack = (socket0 as unknown as FakeSocket).lastOf(SERVER_MESSAGE.ACK)
    expect(ack.commandId).toBe('cmd-1')
    expect(room.state!.version).toBe(versionBefore + 1)

    const update0 = (socket0 as unknown as FakeSocket).lastOf(SERVER_MESSAGE.UPDATE)
    const update1 = (socket1 as unknown as FakeSocket).lastOf(SERVER_MESSAGE.UPDATE)
    expect(update0.version).toBe(room.state!.version)
    expect(update1.version).toBe(room.state!.version)
    // Игрок 0 берёт карты в конце своего хода: сам он видит их состав, а соперник - только счётчик.
    const ownDraw = update0.events.find(e => e.type === 'cards-drawn')
    const opponentDraw = update1.events.find(e => e.type === 'cards-drawn')
    expect(ownDraw && 'cards' in ownDraw && ownDraw.cards).toHaveLength(5)
    expect(opponentDraw && 'cards' in opponentDraw ? opponentDraw.cards : undefined).toBeUndefined()
  })

  it('недопустимая команда: REJECT с кодом ошибки, состояние не меняется', () => {
    const { manager, room, socket0 } = setupMatch()
    const before = room.state
    manager.submitCommand(room, 1, 'cmd-x', { type: COMMAND_TYPE.END_TURN }, socket0 as unknown as Parameters<MatchManager['createMatch']>[0])
    const reject = (socket0 as unknown as FakeSocket).lastOf(SERVER_MESSAGE.REJECT)
    expect(reject).toMatchObject({ commandId: 'cmd-x', reason: 'not-your-turn' })
    expect(room.state).toBe(before)
  })

  it('sync отдаёт полный снимок без событий', () => {
    const { manager, room, socket0 } = setupMatch()
    manager.sync(room, 0)
    const update = (socket0 as unknown as FakeSocket).lastOf(SERVER_MESSAGE.UPDATE)
    expect(update.events).toEqual([])
    expect(update.version).toBe(room.state!.version)
  })
})

describe('matchManager: таймауты', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    return () => vi.useRealTimers()
  })

  it('отключение без переподключения: по истечении таймаута отключившийся сдаётся, соперник побеждает', () => {
    const manager = new MatchManager({ disconnectTimeoutMs: 1000 })
    const socket0 = fakeSocket()
    const { room } = manager.createMatch(socket0)
    const socket1 = fakeSocket()
    manager.joinMatch(socket1, room.code)

    manager.handleDisconnect(room, 0)
    expect(room.state!.winner).toBeNull()

    vi.advanceTimersByTime(999)
    expect(room.state!.winner).toBeNull()

    vi.advanceTimersByTime(2)
    expect(room.state!.winner).toBe(1)
  })

  it('переподключение до истечения таймаута отменяет сдачу', () => {
    const manager = new MatchManager({ disconnectTimeoutMs: 1000 })
    const socket0 = fakeSocket()
    const { room } = manager.createMatch(socket0)
    manager.joinMatch(fakeSocket(), room.code)

    manager.handleDisconnect(room, 0)
    vi.advanceTimersByTime(500)

    const reconnectSocket = fakeSocket()
    const seat0Token = room.seats[0].token
    const result = manager.reconnect(reconnectSocket, room.id, seat0Token)
    expect('error' in result).toBe(false)

    vi.advanceTimersByTime(1000)
    expect(room.state!.winner).toBeNull()
  })

  it('неверный токен переподключения отклоняется', () => {
    const manager = new MatchManager()
    const { room } = manager.createMatch(fakeSocket())
    manager.joinMatch(fakeSocket(), room.code)
    const result = manager.reconnect(fakeSocket(), room.id, 'чужой-токен')
    expect(result).toEqual({ error: MATCH_ERROR.INVALID_TOKEN })
  })

  it('игрок не действует в срок: END_TURN применяется автоматически', () => {
    const manager = new MatchManager({ turnTimeoutMs: 1000 })
    const socket0 = fakeSocket()
    const { room } = manager.createMatch(socket0)
    manager.joinMatch(fakeSocket(), room.code)
    const turnBefore = room.state!.turn

    vi.advanceTimersByTime(1000)
    expect(room.state!.turn).toBe(turnBefore + 1)
  })

  it('открытый prompt на таймауте: выбирается SKIP, если доступен', () => {
    const manager = new MatchManager({ turnTimeoutMs: 1000 })
    const socket0 = fakeSocket()
    const { room } = manager.createMatch(socket0)
    manager.joinMatch(fakeSocket(), room.code)

    // Раскладываем руку игрока 0 так, чтобы был доступен необязательный prompt утилизации (Trade Bot + карта-кандидат).
    room.state!.players[0].hand = [{ id: 'test-trade-bot', cardId: 'trade-bot' }, { id: 'test-scout', cardId: 'scout' }]
    manager.submitCommand(room, 0, 'play', { type: COMMAND_TYPE.PLAY_CARD, cardId: 'test-trade-bot' })
    expect(room.state!.prompt).not.toBeNull()

    vi.advanceTimersByTime(1000)
    expect(room.state!.prompt).toBeNull()
  })

  it('после конца партии таймер хода не запускается', () => {
    const manager = new MatchManager({ turnTimeoutMs: 1000 })
    const socket0 = fakeSocket()
    const { room } = manager.createMatch(socket0)
    manager.joinMatch(fakeSocket(), room.code)

    manager.submitCommand(room, 0, 'concede', { type: COMMAND_TYPE.CONCEDE })
    expect(room.state!.winner).toBe(1)
    const turnAfterConcede = room.state!.turn

    vi.advanceTimersByTime(5000)
    expect(room.state!.turn).toBe(turnAfterConcede)
  })
})
