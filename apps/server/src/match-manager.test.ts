import type { ServerMessage } from '@space/protocol'
import { COMMAND_TYPE } from '@space/engine'
import { MATCH_ERROR, SERVER_MESSAGE } from '@space/protocol'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatchManager } from './match-manager.ts'

/** Заглушка WebSocket: не поднимает реальную сеть, просто копит отправленные сообщения. */
class FakeSocket {
  readyState = 1
  closed = false
  readonly sent: ServerMessage[] = []
  send(data: string): void {
    this.sent.push(JSON.parse(data))
  }

  close(): void {
    this.closed = true
    this.readyState = 3
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
    const manager = new MatchManager({ firstPlayer: 0 })
    const socket = fakeSocket()
    const { room, seat } = manager.createMatch(socket)
    expect(seat).toBe(0)
    const joined = (socket as unknown as FakeSocket).lastOf(SERVER_MESSAGE.JOINED)
    expect(joined).toMatchObject({ matchId: room.id, code: room.code, you: 0, opponentConnected: false })
    expect(room.state).toBeNull()
  })

  it('вход по неверному коду - ошибка not-found', () => {
    const manager = new MatchManager({ firstPlayer: 0 })
    manager.createMatch(fakeSocket())
    const joiner = fakeSocket()
    const result = manager.joinMatch(joiner, 'ZZZZZZ')
    expect(result).toEqual({ error: MATCH_ERROR.NOT_FOUND })
  })

  it('вход по верному коду (без учёта регистра): место 1, партия создаётся, оба получают update', () => {
    const manager = new MatchManager({ firstPlayer: 0 })
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

  it('первого игрока можно задать, иначе он выбирается случайно', () => {
    const fixed = new MatchManager({ firstPlayer: 1 })
    const { room } = fixed.createMatch(fakeSocket())
    fixed.joinMatch(fakeSocket(), room.code)
    expect(room.state!.currentPlayer).toBe(1)

    const seen = new Set<number>()
    for (let i = 0; i < 40 && seen.size < 2; i++) {
      const manager = new MatchManager()
      const created = manager.createMatch(fakeSocket())
      manager.joinMatch(fakeSocket(), created.room.code)
      seen.add(created.room.state!.currentPlayer)
    }
    expect(seen).toEqual(new Set([0, 1]))
  })

  it('третий не может войти в уже заполненный матч', () => {
    const manager = new MatchManager({ firstPlayer: 0 })
    const { room } = manager.createMatch(fakeSocket())
    manager.joinMatch(fakeSocket(), room.code)
    const result = manager.joinMatch(fakeSocket(), room.code)
    expect(result).toEqual({ error: MATCH_ERROR.FULL })
  })
})

describe('matchManager: команды', () => {
  function setupMatch() {
    const manager = new MatchManager({ firstPlayer: 0 })
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
    const manager = new MatchManager({ firstPlayer: 0, disconnectTimeoutMs: 1000 })
    const socket0 = fakeSocket()
    const { room } = manager.createMatch(socket0)
    const socket1 = fakeSocket()
    manager.joinMatch(socket1, room.code)

    manager.handleDisconnect(room, 0, socket0)
    expect(room.state!.winner).toBeNull()

    vi.advanceTimersByTime(999)
    expect(room.state!.winner).toBeNull()

    vi.advanceTimersByTime(2)
    expect(room.state!.winner).toBe(1)
  })

  it('переподключение до истечения таймаута отменяет сдачу', () => {
    const manager = new MatchManager({ firstPlayer: 0, disconnectTimeoutMs: 1000 })
    const socket0 = fakeSocket()
    const { room } = manager.createMatch(socket0)
    manager.joinMatch(fakeSocket(), room.code)

    manager.handleDisconnect(room, 0, socket0)
    vi.advanceTimersByTime(500)

    const reconnectSocket = fakeSocket()
    const seat0Token = room.seats[0].token
    const result = manager.reconnect(reconnectSocket, room.id, seat0Token)
    expect('error' in result).toBe(false)

    vi.advanceTimersByTime(1000)
    expect(room.state!.winner).toBeNull()
  })

  it('неверный токен переподключения отклоняется', () => {
    const manager = new MatchManager({ firstPlayer: 0 })
    const { room } = manager.createMatch(fakeSocket())
    manager.joinMatch(fakeSocket(), room.code)
    const result = manager.reconnect(fakeSocket(), room.id, 'чужой-токен')
    expect(result).toEqual({ error: MATCH_ERROR.INVALID_TOKEN })
  })

  it('переподключение при живом старом сокете закрывает его, а не молча подменяет', () => {
    const manager = new MatchManager({ firstPlayer: 0 })
    const socket0 = fakeSocket()
    const { room } = manager.createMatch(socket0)
    manager.joinMatch(fakeSocket(), room.code)

    const hijackSocket = fakeSocket()
    const result = manager.reconnect(hijackSocket, room.id, room.seats[0].token)
    expect('error' in result).toBe(false)

    expect((socket0 as unknown as FakeSocket).closed).toBe(true)
    expect(room.seats[0].socket).toBe(hijackSocket)
  })

  it('close устаревшего (перехваченного) сокета не отключает место у нового', () => {
    const manager = new MatchManager({ firstPlayer: 0, disconnectTimeoutMs: 1000 })
    const socket0 = fakeSocket()
    const { room } = manager.createMatch(socket0)
    manager.joinMatch(fakeSocket(), room.code)

    const newSocket = fakeSocket()
    manager.reconnect(newSocket, room.id, room.seats[0].token)

    // Устаревшее событие close от старого сокета (пришло бы в app.ts асинхронно) - место занял уже новый сокет.
    manager.handleDisconnect(room, 0, socket0)
    expect(room.seats[0].socket).toBe(newSocket)

    vi.advanceTimersByTime(2000)
    expect(room.state!.winner).toBeNull()
  })

  it('игрок не действует в срок: END_TURN применяется автоматически', () => {
    const manager = new MatchManager({ firstPlayer: 0, turnTimeoutMs: 1000 })
    const socket0 = fakeSocket()
    const { room } = manager.createMatch(socket0)
    manager.joinMatch(fakeSocket(), room.code)
    const turnBefore = room.state!.turn

    vi.advanceTimersByTime(1000)
    expect(room.state!.turn).toBe(turnBefore + 1)
  })

  it('открытый prompt на таймауте: выбирается SKIP, если доступен', () => {
    const manager = new MatchManager({ firstPlayer: 0, turnTimeoutMs: 1000 })
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

  it('update содержит оставшееся время хода: полный таймаут после команды, меньше - в sync позже', () => {
    const manager = new MatchManager({ firstPlayer: 0, turnTimeoutMs: 1000 })
    const socket0 = fakeSocket()
    const { room } = manager.createMatch(socket0)
    manager.joinMatch(fakeSocket(), room.code)
    expect((socket0 as unknown as FakeSocket).lastOf(SERVER_MESSAGE.UPDATE).turnTimeLeftMs).toBe(1000)

    vi.advanceTimersByTime(400)
    manager.sync(room, 0)
    expect((socket0 as unknown as FakeSocket).lastOf(SERVER_MESSAGE.UPDATE).turnTimeLeftMs).toBe(600)
  })

  it('после конца партии update не содержит оставшегося времени', () => {
    const manager = new MatchManager({ firstPlayer: 0, turnTimeoutMs: 1000 })
    const socket0 = fakeSocket()
    const { room } = manager.createMatch(socket0)
    manager.joinMatch(fakeSocket(), room.code)

    manager.submitCommand(room, 0, 'concede', { type: COMMAND_TYPE.CONCEDE })
    expect((socket0 as unknown as FakeSocket).lastOf(SERVER_MESSAGE.UPDATE).turnTimeLeftMs).toBeNull()
  })

  it('после конца партии таймер хода не запускается', () => {
    const manager = new MatchManager({ firstPlayer: 0, turnTimeoutMs: 1000 })
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

describe('matchManager: удаление комнат', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    return () => vi.useRealTimers()
  })

  it('комната без соперника удаляется по таймауту ожидания, создатель получает expired', () => {
    const manager = new MatchManager({ firstPlayer: 0, waitingTimeoutMs: 5000 })
    const socket = fakeSocket()
    const { room } = manager.createMatch(socket)
    expect(manager.roomCount).toBe(1)

    vi.advanceTimersByTime(4999)
    expect(manager.roomCount).toBe(1)
    vi.advanceTimersByTime(1)
    expect(manager.roomCount).toBe(0)
    expect((socket as unknown as FakeSocket).lastOf(SERVER_MESSAGE.ERROR)).toMatchObject({ reason: MATCH_ERROR.EXPIRED })
    expect((socket as unknown as FakeSocket).closed).toBe(true)
    // Код больше не действует.
    expect(manager.joinMatch(fakeSocket(), room.code)).toEqual({ error: MATCH_ERROR.NOT_FOUND })
  })

  it('вход соперника отменяет удаление ожидающей комнаты', () => {
    const manager = new MatchManager({ firstPlayer: 0, waitingTimeoutMs: 5000 })
    const { room } = manager.createMatch(fakeSocket())
    manager.joinMatch(fakeSocket(), room.code)
    vi.advanceTimersByTime(60_000)
    expect(manager.roomCount).toBe(1)
  })

  it('создатель ушёл, не дождавшись: комната удаляется через таймаут отключения, возвращение продлевает ожидание', () => {
    const manager = new MatchManager({ firstPlayer: 0, waitingTimeoutMs: 60_000, disconnectTimeoutMs: 1000 })
    const socket = fakeSocket()
    const { room } = manager.createMatch(socket)
    manager.handleDisconnect(room, 0, socket)

    vi.advanceTimersByTime(500)
    manager.reconnect(fakeSocket(), room.id, room.seats[0].token)
    vi.advanceTimersByTime(5000)
    expect(manager.roomCount).toBe(1)

    const second = fakeSocket()
    manager.handleDisconnect(room, 0, room.seats[0].socket!)
    vi.advanceTimersByTime(1000)
    expect(manager.roomCount).toBe(0)
    expect(second).toBeDefined()
  })

  it('законченная партия удаляется после срока хранения, до этого к ней можно вернуться', () => {
    const manager = new MatchManager({ firstPlayer: 0, finishedTtlMs: 5000 })
    const { room } = manager.createMatch(fakeSocket())
    manager.joinMatch(fakeSocket(), room.code)
    manager.submitCommand(room, 0, 'concede', { type: COMMAND_TYPE.CONCEDE })

    vi.advanceTimersByTime(4000)
    expect('error' in manager.reconnect(fakeSocket(), room.id, room.seats[1].token)).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(manager.roomCount).toBe(0)
  })

  it('игрок молчит несколько ходов подряд: ему засчитывается сдача, команда игрока обнуляет счётчик', () => {
    const manager = new MatchManager({ firstPlayer: 0, turnTimeoutMs: 1000, maxIdleActions: 2 })
    const socket0 = fakeSocket()
    const socket1 = fakeSocket()
    const { room } = manager.createMatch(socket0)
    manager.joinMatch(socket1, room.code)

    // Игрок 0 один раз промолчал, потом сходил сам - счётчик обнулился.
    vi.advanceTimersByTime(1000)
    expect(room.idleActions[0]).toBe(1)
    manager.submitCommand(room, 1, 'a', { type: COMMAND_TYPE.END_TURN }, socket1 as never)
    manager.submitCommand(room, 0, 'b', { type: COMMAND_TYPE.END_TURN }, socket0 as never)
    expect(room.idleActions[0]).toBe(0)

    // Игрок 1 молчит дважды подряд (его ход, потом снова его ход после хода игрока 0).
    vi.advanceTimersByTime(1000)
    expect(room.state!.winner).toBeNull()
    manager.submitCommand(room, 0, 'c', { type: COMMAND_TYPE.END_TURN }, socket0 as never)
    vi.advanceTimersByTime(1000)
    expect(room.state!.winner).toBe(0)
  })

  it('dispose останавливает все таймеры и убирает комнаты', () => {
    const manager = new MatchManager({ firstPlayer: 0, turnTimeoutMs: 1000 })
    const { room } = manager.createMatch(fakeSocket())
    manager.joinMatch(fakeSocket(), room.code)
    manager.dispose()
    expect(manager.roomCount).toBe(0)
    vi.advanceTimersByTime(10_000)
    expect(room.state!.turn).toBe(1)
  })
})

describe('matchManager: статус соперника', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    return () => vi.useRealTimers()
  })

  it('создатель узнаёт о входе соперника, отключение и возвращение рассылаются с отсчётом до сдачи', () => {
    const manager = new MatchManager({ firstPlayer: 0, disconnectTimeoutMs: 10_000 })
    const socket0 = fakeSocket()
    const socket1 = fakeSocket()
    const { room } = manager.createMatch(socket0)
    manager.joinMatch(socket1, room.code)
    expect((socket0 as unknown as FakeSocket).lastOf(SERVER_MESSAGE.OPPONENT_STATUS)).toEqual({
      type: SERVER_MESSAGE.OPPONENT_STATUS,
      connected: true,
      reconnectTimeLeftMs: null,
    })

    manager.handleDisconnect(room, 1, socket1)
    expect((socket0 as unknown as FakeSocket).lastOf(SERVER_MESSAGE.OPPONENT_STATUS)).toMatchObject({ connected: false, reconnectTimeLeftMs: 10_000 })

    vi.advanceTimersByTime(4000)
    const back = fakeSocket()
    manager.reconnect(back, room.id, room.seats[1].token)
    expect((socket0 as unknown as FakeSocket).lastOf(SERVER_MESSAGE.OPPONENT_STATUS)).toMatchObject({ connected: true, reconnectTimeLeftMs: null })
    // Вернувшийся игрок тоже получает статус соперника.
    expect((back as unknown as FakeSocket).lastOf(SERVER_MESSAGE.OPPONENT_STATUS)).toMatchObject({ connected: true })
  })

  it('вернувшийся игрок узнаёт, что соперник ещё не вернулся', () => {
    const manager = new MatchManager({ firstPlayer: 0, disconnectTimeoutMs: 10_000 })
    const socket0 = fakeSocket()
    const socket1 = fakeSocket()
    const { room } = manager.createMatch(socket0)
    manager.joinMatch(socket1, room.code)
    manager.handleDisconnect(room, 0, socket0)
    vi.advanceTimersByTime(3000)
    manager.handleDisconnect(room, 1, socket1)

    const back = fakeSocket()
    manager.reconnect(back, room.id, room.seats[1].token)
    expect((back as unknown as FakeSocket).lastOf(SERVER_MESSAGE.OPPONENT_STATUS)).toMatchObject({ connected: false, reconnectTimeLeftMs: 7000 })
  })
})
