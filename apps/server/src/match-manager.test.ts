import { COMMAND_TYPE } from '@space/engine'
import { END_REASON, MATCH_ERROR, SERVER_MESSAGE } from '@space/protocol'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatchManager } from './match-manager.ts'
import { COMMAND_SOURCE } from './room.ts'
import { fakeSocket, setupMatch } from './testing.ts'

describe('matchManager: создание и вход по коду', () => {
  it('создатель получает код и место 0, opponentConnected: false', () => {
    const manager = new MatchManager({ firstPlayer: 0 })
    const socket = fakeSocket()
    const { room, seat } = manager.createMatch(socket, 'Алиса')
    expect(seat).toBe(0)
    expect(socket.lastOf(SERVER_MESSAGE.JOINED)).toMatchObject({ matchId: room.id, code: room.code, you: 0, opponentConnected: false })
    expect(room.state).toBeNull()
  })

  it('вход по неверному коду - ошибка not-found', () => {
    const manager = new MatchManager({ firstPlayer: 0 })
    manager.createMatch(fakeSocket(), 'Алиса')
    expect(manager.joinMatch(fakeSocket(), 'ZZZZZZ', 'Боб')).toEqual({ error: MATCH_ERROR.NOT_FOUND })
  })

  it('вход по верному коду (без учёта регистра): место 1, партия создаётся, оба получают update', () => {
    const manager = new MatchManager({ firstPlayer: 0 })
    const creatorSocket = fakeSocket()
    const { room } = manager.createMatch(creatorSocket, 'Алиса')
    const joinerSocket = fakeSocket()

    const result = manager.joinMatch(joinerSocket, room.code.toLowerCase(), 'Боб')
    expect('error' in result).toBe(false)
    expect(room.state).not.toBeNull()

    expect(joinerSocket.lastOf(SERVER_MESSAGE.JOINED)).toMatchObject({ you: 1, opponentConnected: true })

    const creatorUpdate = creatorSocket.lastOf(SERVER_MESSAGE.UPDATE)
    const joinerUpdate = joinerSocket.lastOf(SERVER_MESSAGE.UPDATE)
    expect(creatorUpdate.events).toEqual([])
    expect(joinerUpdate.view.you).toBe(1)
    expect(creatorUpdate.view.you).toBe(0)
  })

  it('имена игроков приходят в update по номерам мест', () => {
    const { socket0, socket1 } = setupMatch()
    expect(socket0.lastOf(SERVER_MESSAGE.UPDATE).names).toEqual(['Алиса', 'Боб'])
    expect(socket1.lastOf(SERVER_MESSAGE.UPDATE).names).toEqual(['Алиса', 'Боб'])
  })

  it('первого игрока можно задать, иначе он выбирается случайно', () => {
    const fixed = new MatchManager({ firstPlayer: 1 })
    const { room } = fixed.createMatch(fakeSocket(), 'Алиса')
    fixed.joinMatch(fakeSocket(), room.code, 'Боб')
    expect(room.state!.currentPlayer).toBe(1)

    const seen = new Set<number>()
    for (let i = 0; i < 40 && seen.size < 2; i++) {
      const manager = new MatchManager()
      const created = manager.createMatch(fakeSocket(), 'Алиса')
      manager.joinMatch(fakeSocket(), created.room.code, 'Боб')
      seen.add(created.room.state!.currentPlayer)
    }
    expect(seen).toEqual(new Set([0, 1]))
  })

  it('третий не может войти в уже заполненный матч', () => {
    const { manager, room } = setupMatch()
    expect(manager.joinMatch(fakeSocket(), room.code, 'Вика')).toEqual({ error: MATCH_ERROR.FULL })
  })

  it('коды разных комнат не совпадают', () => {
    const manager = new MatchManager()
    const codes = new Set(Array.from({ length: 50 }, () => manager.createMatch(fakeSocket(), 'Алиса').room.code))
    expect(codes.size).toBe(50)
  })

  it('на сервере хранится только хэш токена, а не сам токен', () => {
    const { room, socket0 } = setupMatch()
    expect(room.seats[0].tokenHash).not.toBe(socket0.token)
    expect(room.seats[0].tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('matchManager: команды', () => {
  it('допустимая команда: ACK отправителю, UPDATE обоим с версией и урезанными событиями', () => {
    const { manager, room, socket0, socket1 } = setupMatch()
    const versionBefore = room.state!.version

    manager.submitCommand(room, 0, 'cmd-1', { type: COMMAND_TYPE.END_TURN }, socket0)

    expect(socket0.lastOf(SERVER_MESSAGE.ACK).commandId).toBe('cmd-1')
    expect(room.state!.version).toBe(versionBefore + 1)

    const update0 = socket0.lastOf(SERVER_MESSAGE.UPDATE)
    const update1 = socket1.lastOf(SERVER_MESSAGE.UPDATE)
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
    manager.submitCommand(room, 1, 'cmd-x', { type: COMMAND_TYPE.END_TURN }, socket0)
    expect(socket0.lastOf(SERVER_MESSAGE.REJECT)).toMatchObject({ commandId: 'cmd-x', reason: 'not-your-turn' })
    expect(room.state).toBe(before)
  })

  it('sync отдаёт полный снимок без событий', () => {
    const { manager, room, socket0 } = setupMatch()
    manager.sync(room, 0)
    const update = socket0.lastOf(SERVER_MESSAGE.UPDATE)
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
    const { manager, room, socket0 } = setupMatch({ firstPlayer: 0, disconnectTimeoutMs: 1000 })

    manager.handleDisconnect(room, 0, socket0)
    expect(room.state!.winner).toBeNull()

    vi.advanceTimersByTime(999)
    expect(room.state!.winner).toBeNull()

    vi.advanceTimersByTime(2)
    expect(room.state!.winner).toBe(1)
    expect(room.endReason).toBe(END_REASON.DISCONNECT)
  })

  it('переподключение до истечения таймаута отменяет сдачу', () => {
    const { manager, room, socket0 } = setupMatch({ firstPlayer: 0, disconnectTimeoutMs: 1000 })

    manager.handleDisconnect(room, 0, socket0)
    vi.advanceTimersByTime(500)

    const result = manager.reconnect(fakeSocket(), room.id, socket0.token)
    expect('error' in result).toBe(false)

    vi.advanceTimersByTime(1000)
    expect(room.state!.winner).toBeNull()
  })

  it('неверный токен переподключения отклоняется', () => {
    const { manager, room } = setupMatch()
    expect(manager.reconnect(fakeSocket(), room.id, 'чужой-токен')).toEqual({ error: MATCH_ERROR.INVALID_TOKEN })
  })

  it('переподключение при живом старом сокете закрывает его, а не молча подменяет', () => {
    const { manager, room, socket0 } = setupMatch()

    const hijackSocket = fakeSocket()
    const result = manager.reconnect(hijackSocket, room.id, socket0.token)
    expect('error' in result).toBe(false)

    expect(socket0.closed).toBe(true)
    expect(room.seats[0].socket).toBe(hijackSocket)
    expect(manager.bindingOf(socket0)).toBeUndefined()
    expect(manager.bindingOf(hijackSocket)).toMatchObject({ seat: 0 })
  })

  it('close устаревшего (перехваченного) сокета не отключает место у нового', () => {
    const { manager, room, socket0 } = setupMatch({ firstPlayer: 0, disconnectTimeoutMs: 1000 })

    const newSocket = fakeSocket()
    manager.reconnect(newSocket, room.id, socket0.token)

    // Устаревшее событие close от старого сокета (пришло бы в app.ts асинхронно) - место занял уже новый сокет.
    manager.handleClose(socket0)
    manager.handleDisconnect(room, 0, socket0)
    expect(room.seats[0].socket).toBe(newSocket)

    vi.advanceTimersByTime(2000)
    expect(room.state!.winner).toBeNull()
  })

  it('игрок не действует в срок: END_TURN применяется автоматически', () => {
    const { room } = setupMatch({ firstPlayer: 0, turnTimeoutMs: 1000 })
    const turnBefore = room.state!.turn

    vi.advanceTimersByTime(1000)
    expect(room.state!.turn).toBe(turnBefore + 1)
  })

  it('открытый prompt на таймауте: выбирается SKIP, если доступен', () => {
    const { manager, room } = setupMatch({ firstPlayer: 0, turnTimeoutMs: 1000 })

    // Раскладываем руку игрока 0 так, чтобы был доступен необязательный prompt утилизации (Trade Bot + карта-кандидат).
    room.state!.players[0].hand = [{ id: 'test-trade-bot', cardId: 'trade-bot' }, { id: 'test-scout', cardId: 'scout' }]
    manager.submitCommand(room, 0, 'play', { type: COMMAND_TYPE.PLAY_CARD, cardId: 'test-trade-bot' })
    expect(room.state!.prompt).not.toBeNull()

    vi.advanceTimersByTime(1000)
    expect(room.state!.prompt).toBeNull()
  })

  it('update содержит оставшееся время хода: полный таймаут после команды, меньше - в sync позже', () => {
    const { manager, room, socket0 } = setupMatch({ firstPlayer: 0, turnTimeoutMs: 1000 })
    expect(socket0.lastOf(SERVER_MESSAGE.UPDATE).turnTimeLeftMs).toBe(1000)

    vi.advanceTimersByTime(400)
    manager.sync(room, 0)
    expect(socket0.lastOf(SERVER_MESSAGE.UPDATE).turnTimeLeftMs).toBe(600)
  })

  it('после конца партии update не содержит оставшегося времени', () => {
    const { manager, room, socket0 } = setupMatch({ firstPlayer: 0, turnTimeoutMs: 1000 })

    manager.submitCommand(room, 0, 'concede', { type: COMMAND_TYPE.CONCEDE })
    expect(socket0.lastOf(SERVER_MESSAGE.UPDATE).turnTimeLeftMs).toBeNull()
  })

  it('после конца партии таймер хода не запускается', () => {
    const { manager, room } = setupMatch({ firstPlayer: 0, turnTimeoutMs: 1000 })

    manager.submitCommand(room, 0, 'concede', { type: COMMAND_TYPE.CONCEDE })
    expect(room.state!.winner).toBe(1)
    const turnAfterConcede = room.state!.turn

    vi.advanceTimersByTime(5000)
    expect(room.state!.turn).toBe(turnAfterConcede)
  })
})

describe('matchManager: причина конца партии', () => {
  it('обнулённый авторитет: authority', () => {
    const { manager, room, socket1 } = setupMatch()
    room.state!.players[1].authority = 3
    room.state!.pools.combat = 5
    manager.submitCommand(room, 0, 'hit', { type: COMMAND_TYPE.ATTACK_PLAYER, amount: 3 })
    expect(room.state!.winner).toBe(0)
    expect(socket1.lastOf(SERVER_MESSAGE.UPDATE).endReason).toBe(END_REASON.AUTHORITY)
  })

  it('сдача по кнопке: concede, пока партия идёт - null', () => {
    const { manager, room, socket0, socket1 } = setupMatch()
    expect(socket0.lastOf(SERVER_MESSAGE.UPDATE).endReason).toBeNull()
    manager.submitCommand(room, 1, 'give-up', { type: COMMAND_TYPE.CONCEDE }, socket1)
    expect(socket0.lastOf(SERVER_MESSAGE.UPDATE).endReason).toBe(END_REASON.CONCEDE)
  })

  it('сдача от имени сервера по отключению и по бездействию', () => {
    const disconnect = setupMatch()
    disconnect.manager.submitCommand(disconnect.room, 0, 'x', { type: COMMAND_TYPE.CONCEDE }, undefined, COMMAND_SOURCE.DISCONNECT)
    expect(disconnect.room.endReason).toBe(END_REASON.DISCONNECT)

    const idle = setupMatch()
    idle.manager.submitCommand(idle.room, 0, 'x', { type: COMMAND_TYPE.CONCEDE }, undefined, COMMAND_SOURCE.IDLE)
    expect(idle.room.endReason).toBe(END_REASON.IDLE)
  })

  it('бездействие, дошедшее до сдачи по таймеру, получает причину idle', () => {
    vi.useFakeTimers()
    try {
      const { room } = setupMatch({ firstPlayer: 0, turnTimeoutMs: 1000, maxIdleActions: 1 })
      vi.advanceTimersByTime(1000)
      expect(room.state!.winner).toBe(1)
      expect(room.endReason).toBe(END_REASON.IDLE)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('синхронизация после конца партии тоже содержит причину', () => {
    const { manager, room, socket0 } = setupMatch()
    manager.submitCommand(room, 0, 'give-up', { type: COMMAND_TYPE.CONCEDE })
    manager.sync(room, 0)
    expect(socket0.lastOf(SERVER_MESSAGE.UPDATE).endReason).toBe(END_REASON.CONCEDE)
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
    const { room } = manager.createMatch(socket, 'Алиса')
    expect(manager.roomCount).toBe(1)

    vi.advanceTimersByTime(4999)
    expect(manager.roomCount).toBe(1)
    vi.advanceTimersByTime(1)
    expect(manager.roomCount).toBe(0)
    expect(socket.lastOf(SERVER_MESSAGE.ERROR)).toMatchObject({ reason: MATCH_ERROR.EXPIRED })
    expect(socket.closed).toBe(true)
    // Код больше не действует.
    expect(manager.joinMatch(fakeSocket(), room.code, 'Боб')).toEqual({ error: MATCH_ERROR.NOT_FOUND })
  })

  it('вход соперника отменяет удаление ожидающей комнаты', () => {
    const manager = new MatchManager({ firstPlayer: 0, waitingTimeoutMs: 5000 })
    const { room } = manager.createMatch(fakeSocket(), 'Алиса')
    manager.joinMatch(fakeSocket(), room.code, 'Боб')
    vi.advanceTimersByTime(60_000)
    expect(manager.roomCount).toBe(1)
  })

  it('создатель ушёл, не дождавшись: комната удаляется через таймаут отключения, возвращение продлевает ожидание', () => {
    const manager = new MatchManager({ firstPlayer: 0, waitingTimeoutMs: 60_000, disconnectTimeoutMs: 1000 })
    const socket = fakeSocket()
    const { room } = manager.createMatch(socket, 'Алиса')
    manager.handleDisconnect(room, 0, socket)

    vi.advanceTimersByTime(500)
    const back = fakeSocket()
    manager.reconnect(back, room.id, socket.token)
    vi.advanceTimersByTime(5000)
    expect(manager.roomCount).toBe(1)

    manager.handleDisconnect(room, 0, back)
    vi.advanceTimersByTime(1000)
    expect(manager.roomCount).toBe(0)
  })

  it('законченная партия удаляется после срока хранения, до этого к ней можно вернуться', () => {
    const { manager, room, socket1 } = setupMatch({ firstPlayer: 0, finishedTtlMs: 5000 })
    manager.submitCommand(room, 0, 'concede', { type: COMMAND_TYPE.CONCEDE })

    vi.advanceTimersByTime(4000)
    expect('error' in manager.reconnect(fakeSocket(), room.id, socket1.token)).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(manager.roomCount).toBe(0)
  })

  it('игрок молчит несколько ходов подряд: ему засчитывается сдача, команда игрока обнуляет счётчик', () => {
    const { manager, room, socket0, socket1 } = setupMatch({ firstPlayer: 0, turnTimeoutMs: 1000, maxIdleActions: 2 })

    // Игрок 0 один раз промолчал, потом сходил сам - счётчик обнулился.
    vi.advanceTimersByTime(1000)
    expect(room.idleActions[0]).toBe(1)
    manager.submitCommand(room, 1, 'a', { type: COMMAND_TYPE.END_TURN }, socket1)
    manager.submitCommand(room, 0, 'b', { type: COMMAND_TYPE.END_TURN }, socket0)
    expect(room.idleActions[0]).toBe(0)

    // Игрок 1 молчит дважды подряд (его ход, потом снова его ход после хода игрока 0).
    vi.advanceTimersByTime(1000)
    expect(room.state!.winner).toBeNull()
    manager.submitCommand(room, 0, 'c', { type: COMMAND_TYPE.END_TURN }, socket0)
    vi.advanceTimersByTime(1000)
    expect(room.state!.winner).toBe(0)
  })

  it('dispose останавливает все таймеры и убирает комнаты', async () => {
    const { manager, room } = setupMatch({ firstPlayer: 0, turnTimeoutMs: 1000 })
    await manager.dispose()
    expect(manager.roomCount).toBe(0)
    vi.advanceTimersByTime(10_000)
    expect(room.state!.turn).toBe(1)
  })

  it('отключились оба игрока: сдачи нет, партия считается брошенной и комната удаляется', () => {
    const { manager, room, socket0, socket1 } = setupMatch({ firstPlayer: 0, disconnectTimeoutMs: 1000 })
    manager.handleClose(socket0)
    vi.advanceTimersByTime(300)
    manager.handleClose(socket1)

    vi.advanceTimersByTime(700)
    expect(manager.roomCount).toBe(0)
    expect(room.state!.winner).toBeNull()
  })
})

describe('matchManager: статус соперника', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    return () => vi.useRealTimers()
  })

  it('оба узнают друг о друге при старте, отключение и возвращение рассылаются с отсчётом до сдачи', () => {
    const { manager, room, socket0, socket1 } = setupMatch({ firstPlayer: 0, disconnectTimeoutMs: 10_000 })
    expect(socket0.lastOf(SERVER_MESSAGE.OPPONENT_STATUS)).toEqual({
      type: SERVER_MESSAGE.OPPONENT_STATUS,
      connected: true,
      reconnectTimeLeftMs: null,
    })

    manager.handleDisconnect(room, 1, socket1)
    expect(socket0.lastOf(SERVER_MESSAGE.OPPONENT_STATUS)).toMatchObject({ connected: false, reconnectTimeLeftMs: 10_000 })

    vi.advanceTimersByTime(4000)
    const back = fakeSocket()
    manager.reconnect(back, room.id, socket1.token)
    expect(socket0.lastOf(SERVER_MESSAGE.OPPONENT_STATUS)).toMatchObject({ connected: true, reconnectTimeLeftMs: null })
    // Вернувшийся игрок тоже получает статус соперника.
    expect(back.lastOf(SERVER_MESSAGE.OPPONENT_STATUS)).toMatchObject({ connected: true })
  })

  it('вернувшийся игрок узнаёт, что соперник ещё не вернулся', () => {
    const { manager, room, socket0, socket1 } = setupMatch({ firstPlayer: 0, disconnectTimeoutMs: 10_000 })
    manager.handleDisconnect(room, 0, socket0)
    vi.advanceTimersByTime(3000)
    manager.handleDisconnect(room, 1, socket1)

    const back = fakeSocket()
    manager.reconnect(back, room.id, socket1.token)
    expect(back.lastOf(SERVER_MESSAGE.OPPONENT_STATUS)).toMatchObject({ connected: false, reconnectTimeLeftMs: 7000 })
  })
})

describe('matchManager: выход из матча', () => {
  it('ожидающая комната закрывается, сокет остаётся открытым и может сразу создать новый матч', () => {
    const manager = new MatchManager({ firstPlayer: 0 })
    const socket = fakeSocket()
    const { room } = manager.createMatch(socket, 'Алиса')

    manager.leaveMatch(socket)
    expect(manager.roomCount).toBe(0)
    expect(socket.closed).toBe(false)
    expect(manager.bindingOf(socket)).toBeUndefined()
    expect(manager.joinMatch(fakeSocket(), room.code, 'Боб')).toEqual({ error: MATCH_ERROR.NOT_FOUND })

    const again = manager.createMatch(socket, 'Алиса')
    expect(again.room.id).not.toBe(room.id)
  })

  it('выход из идущей партии засчитывает сдачу, ушедший больше ничего не получает', () => {
    const { manager, room, socket0, socket1 } = setupMatch()
    const sentBefore = socket0.sent.length

    manager.leaveMatch(socket0)
    expect(room.state!.winner).toBe(1)
    expect(room.endReason).toBe(END_REASON.CONCEDE)
    expect(socket0.sent).toHaveLength(sentBefore)
    expect(socket1.lastOf(SERVER_MESSAGE.UPDATE).endReason).toBe(END_REASON.CONCEDE)
    expect(manager.bindingOf(socket0)).toBeUndefined()
    // Вернуться на оставленное место по токену нельзя.
    expect(manager.reconnect(fakeSocket(), room.id, socket0.token)).toEqual({ error: MATCH_ERROR.INVALID_TOKEN })
  })

  it('выход без матча ничего не делает', () => {
    const manager = new MatchManager()
    expect(() => manager.leaveMatch(fakeSocket())).not.toThrow()
  })
})

describe('matchManager: быстрый поиск', () => {
  it('игрок без имени получает имя по умолчанию для своего места: Митяй - первый, Валера - второй', () => {
    const manager = new MatchManager({ firstPlayer: 0 })
    const socket0 = fakeSocket()
    const { room } = manager.createMatch(socket0, '')
    manager.joinMatch(fakeSocket(), room.code, '')
    expect(socket0.lastOf(SERVER_MESSAGE.UPDATE).names).toEqual(['Митяй', 'Валера'])
  })

  it('свои имена не заменяются: по умолчанию называют только того, кто имя не указал', () => {
    const manager = new MatchManager({ firstPlayer: 0 })
    const socket0 = fakeSocket()
    const { room } = manager.createMatch(socket0, 'Алиса')
    manager.joinMatch(fakeSocket(), room.code, '')
    expect(socket0.lastOf(SERVER_MESSAGE.UPDATE).names).toEqual(['Алиса', 'Валера'])
  })

  it('первый встаёт в очередь, второй сводится с ним: оба получают JOINED и партию, имена сохраняются', () => {
    const manager = new MatchManager({ firstPlayer: 0 })
    const a = fakeSocket()
    const b = fakeSocket()

    manager.findMatch(a, 'Алиса')
    expect(a.lastOf(SERVER_MESSAGE.SEARCH_STATUS)).toEqual({ type: SERVER_MESSAGE.SEARCH_STATUS, searching: true })
    expect(manager.searchingCount).toBe(1)
    expect(manager.roomCount).toBe(0)

    manager.findMatch(b, 'Боб')
    expect(manager.searchingCount).toBe(0)
    expect(manager.roomCount).toBe(1)
    expect(a.lastOf(SERVER_MESSAGE.JOINED)).toMatchObject({ you: 0, opponentConnected: true })
    expect(b.lastOf(SERVER_MESSAGE.JOINED)).toMatchObject({ you: 1, opponentConnected: true })
    expect(a.lastOf(SERVER_MESSAGE.UPDATE).names).toEqual(['Алиса', 'Боб'])
    expect(manager.bindingOf(a)).toMatchObject({ seat: 0 })
    expect(manager.bindingOf(b)).toMatchObject({ seat: 1 })
  })

  it('повторный поиск того же сокета очередь не удваивает', () => {
    const manager = new MatchManager()
    const a = fakeSocket()
    manager.findMatch(a, 'Алиса')
    manager.findMatch(a, 'Алиса')
    expect(manager.searchingCount).toBe(1)
    expect(manager.roomCount).toBe(0)
  })

  it('отмена убирает из очереди и сообщает об этом', () => {
    const manager = new MatchManager()
    const a = fakeSocket()
    manager.findMatch(a, 'Алиса')
    manager.cancelSearch(a)
    expect(manager.searchingCount).toBe(0)
    expect(a.lastOf(SERVER_MESSAGE.SEARCH_STATUS)).toMatchObject({ searching: false })

    // Следующий искатель никого не находит.
    manager.findMatch(fakeSocket(), 'Боб')
    expect(manager.roomCount).toBe(0)
  })

  it('закрытый сокет в очереди с партнёром не сводится', () => {
    const manager = new MatchManager()
    const gone = fakeSocket()
    manager.findMatch(gone, 'Алиса')
    manager.handleClose(gone)
    expect(manager.searchingCount).toBe(0)

    const next = fakeSocket()
    manager.findMatch(next, 'Боб')
    expect(manager.roomCount).toBe(0)
    expect(manager.searchingCount).toBe(1)
  })

  it('сокет, который закрылся без handleClose, пропускается при поиске пары', () => {
    const manager = new MatchManager()
    const stale = fakeSocket()
    manager.findMatch(stale, 'Алиса')
    stale.close()

    manager.findMatch(fakeSocket(), 'Боб')
    expect(manager.roomCount).toBe(0)
  })

  it('создание матча снимает с очереди', () => {
    const manager = new MatchManager()
    const a = fakeSocket()
    manager.findMatch(a, 'Алиса')
    manager.createMatch(a, 'Алиса')
    expect(manager.searchingCount).toBe(0)
  })
})

describe('matchManager: реванш', () => {
  /** Партия, закончившаяся сдачей игрока 1: победитель - игрок 0. */
  function finishedMatch() {
    const match = setupMatch({ firstPlayer: 0 })
    match.manager.submitCommand(match.room, 1, 'give-up', { type: COMMAND_TYPE.CONCEDE })
    return match
  }

  it('по окончании партии оба получают статус реванша: никто не предлагал, соперник на месте', () => {
    const { socket0, socket1 } = finishedMatch()
    const expected = { type: SERVER_MESSAGE.REMATCH_STATUS, you: false, opponent: false, available: true }
    expect(socket0.lastOf(SERVER_MESSAGE.REMATCH_STATUS)).toEqual(expected)
    expect(socket1.lastOf(SERVER_MESSAGE.REMATCH_STATUS)).toEqual(expected)
  })

  it('во время партии реванш предложить нельзя', () => {
    const { manager, socket0, socket1 } = setupMatch()
    manager.requestRematch(socket0)
    expect(socket1.has(SERVER_MESSAGE.REMATCH_STATUS)).toBe(false)
  })

  it('предложение видит соперник, второе согласие начинает новую партию с теми же именами', () => {
    const { manager, room, socket0, socket1 } = finishedMatch()

    manager.requestRematch(socket0)
    expect(socket0.lastOf(SERVER_MESSAGE.REMATCH_STATUS)).toMatchObject({ you: true, opponent: false })
    expect(socket1.lastOf(SERVER_MESSAGE.REMATCH_STATUS)).toMatchObject({ you: false, opponent: true })
    expect(manager.roomCount).toBe(1)

    manager.requestRematch(socket1)
    const joined0 = socket0.lastOf(SERVER_MESSAGE.JOINED)
    const joined1 = socket1.lastOf(SERVER_MESSAGE.JOINED)
    expect(joined0.matchId).not.toBe(room.id)
    expect(joined1.matchId).toBe(joined0.matchId)
    expect(joined0).toMatchObject({ you: 0, opponentConnected: true })
    expect(joined1).toMatchObject({ you: 1, opponentConnected: true })
    expect(manager.roomCount).toBe(1)

    const update = socket0.lastOf(SERVER_MESSAGE.UPDATE)
    expect(update.names).toEqual(['Алиса', 'Боб'])
    expect(update.endReason).toBeNull()
    expect(update.view.winner).toBeNull()
    expect(manager.bindingOf(socket0)!.room.id).toBe(joined0.matchId)
    expect(socket0.closed).toBe(false)
  })

  it('после ухода соперника реванш недоступен, предложение игнорируется', () => {
    const { manager, socket0, socket1 } = finishedMatch()

    manager.leaveMatch(socket1)
    expect(socket0.lastOf(SERVER_MESSAGE.REMATCH_STATUS)).toMatchObject({ available: false })

    manager.requestRematch(socket0)
    expect(socket0.lastOf(SERVER_MESSAGE.REMATCH_STATUS)).toMatchObject({ you: false, available: false })
    expect(manager.roomCount).toBe(1)
  })

  it('отключение соперника делает реванш недоступным, возвращение - снова доступным, но без его прежнего предложения', () => {
    const { manager, room, socket0, socket1 } = finishedMatch()
    manager.requestRematch(socket1)

    manager.handleClose(socket1)
    expect(socket0.lastOf(SERVER_MESSAGE.REMATCH_STATUS)).toMatchObject({ opponent: false, available: false })

    const back = fakeSocket()
    manager.reconnect(back, room.id, socket1.token)
    expect(socket0.lastOf(SERVER_MESSAGE.REMATCH_STATUS)).toMatchObject({ opponent: false, available: true })
    expect(back.lastOf(SERVER_MESSAGE.REMATCH_STATUS)).toMatchObject({ you: false, available: true })
  })

  it('уход игрока снимает его предложение', () => {
    const { manager, socket0, socket1 } = finishedMatch()
    manager.requestRematch(socket0)
    manager.leaveMatch(socket0)
    expect(socket1.lastOf(SERVER_MESSAGE.REMATCH_STATUS)).toMatchObject({ opponent: false, available: false })
  })
})
