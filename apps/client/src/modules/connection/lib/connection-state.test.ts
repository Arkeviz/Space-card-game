import type { PlayerView } from '@space/engine'
import type { UpdateMessage } from '@space/protocol'
import { COMMAND_TYPE } from '@space/engine'
import { END_REASON, MATCH_ERROR, SERVER_MESSAGE } from '@space/protocol'
import { describe, expect, it, vi } from 'vitest'
import { ConnectionState } from './connection-state'

const view: PlayerView = {
  version: 1,
  you: 0,
  currentPlayer: 0,
  turn: 1,
  winner: null,
  pools: { trade: 0, combat: 0 },
  self: { authority: 50, deckCount: 7, discard: [], inPlay: [], hand: [], deckContents: {} },
  opponent: { authority: 50, deckCount: 5, discard: [], inPlay: [], handCount: 5 },
  tradeRow: [null, null, null, null, null],
  tradeDeckCount: 25,
  explorersCount: 10,
  scrapHeap: [],
  prompt: null,
}

const names: [string, string] = ['Алиса', 'Боб']

describe('connectionState.handleServerMessage', () => {
  it('joined заполняет данные матча и возвращает секрет для переподключения', () => {
    const state = new ConnectionState()
    const info = state.handleServerMessage({
      type: SERVER_MESSAGE.JOINED,
      matchId: 'm1',
      code: 'ABC123',
      you: 0,
      token: 't1',
      opponentConnected: false,
    })
    expect(info).toEqual({ matchId: 'm1', token: 't1' })
    expect(state.matchId).toBe('m1')
    expect(state.code).toBe('ABC123')
    expect(state.you).toBe(0)
    expect(state.opponentConnected).toBe(false)
  })

  it('joined сбрасывает предыдущую ошибку', () => {
    const state = new ConnectionState()
    state.handleServerMessage({ type: SERVER_MESSAGE.ERROR, reason: MATCH_ERROR.NOT_FOUND })
    expect(state.lastError).toBe(MATCH_ERROR.NOT_FOUND)
    state.handleServerMessage({ type: SERVER_MESSAGE.JOINED, matchId: 'm1', code: 'ABC123', you: 0, token: 't1', opponentConnected: false })
    expect(state.lastError).toBeNull()
  })

  it('update заполняет view/legalActions/lastEvents и отмечает соперника подключённым', () => {
    const state = new ConnectionState()
    const info = state.handleServerMessage({
      type: SERVER_MESSAGE.UPDATE,
      version: 1,
      events: [{ type: 'turn-started', player: 0, turn: 1 }],
      view,
      legalActions: [{ type: COMMAND_TYPE.END_TURN }],
      turnTimeLeftMs: 90_000,
      names,
      endReason: null,
    })
    expect(info).toBeNull()
    expect(state.view).toBe(view)
    expect(state.legalActions).toEqual([{ type: COMMAND_TYPE.END_TURN }])
    expect(state.lastEvents).toEqual([{ type: 'turn-started', player: 0, turn: 1 }])
    expect(state.opponentConnected).toBe(true)
  })

  it('update раздаётся подписчикам целиком, подписку можно снять', () => {
    const state = new ConnectionState()
    const listener = vi.fn()
    const unsubscribe = state.subscribeUpdates(listener)
    const update: UpdateMessage = { type: SERVER_MESSAGE.UPDATE, version: 2, events: [], view, legalActions: [], turnTimeLeftMs: 5000, names, endReason: null }
    state.handleServerMessage(update)
    expect(listener).toHaveBeenCalledExactlyOnceWith(update)
    expect(state.turnTimeLeftMs).toBe(5000)

    unsubscribe()
    state.handleServerMessage(update)
    expect(listener).toHaveBeenCalledOnce()
  })

  it('leave забывает матч и разрешает ожидающие команды как потерянные', () => {
    const state = new ConnectionState()
    state.handleServerMessage({ type: SERVER_MESSAGE.JOINED, matchId: 'm1', code: 'ABC123', you: 0, token: 't1', opponentConnected: true })
    state.handleServerMessage({ type: SERVER_MESSAGE.UPDATE, version: 1, events: [], view, legalActions: [], turnTimeLeftMs: null, names, endReason: null })
    const resolve = vi.fn()
    state.registerPending('cmd-1', resolve)

    state.leave()
    expect(state.matchId).toBeNull()
    expect(state.view).toBeNull()
    expect(state.you).toBeNull()
    expect(resolve).toHaveBeenCalledExactlyOnceWith({ ok: false, reason: 'connection-lost' })
  })

  it('error записывает причину', () => {
    const state = new ConnectionState()
    state.handleServerMessage({ type: SERVER_MESSAGE.ERROR, reason: MATCH_ERROR.FULL })
    expect(state.lastError).toBe(MATCH_ERROR.FULL)
  })
})

describe('connectionState: ожидающие команды', () => {
  it('ack разрешает нужный resolver с {ok: true}, ровно один раз', () => {
    const state = new ConnectionState()
    const resolve = vi.fn()
    state.registerPending('cmd-1', resolve)
    state.handleServerMessage({ type: SERVER_MESSAGE.ACK, commandId: 'cmd-1' })
    expect(resolve).toHaveBeenCalledExactlyOnceWith({ ok: true })

    resolve.mockClear()
    state.handleServerMessage({ type: SERVER_MESSAGE.ACK, commandId: 'cmd-1' })
    expect(resolve).not.toHaveBeenCalled()
  })

  it('reject разрешает нужный resolver с {ok: false, reason}', () => {
    const state = new ConnectionState()
    const resolve = vi.fn()
    state.registerPending('cmd-1', resolve)
    state.handleServerMessage({ type: SERVER_MESSAGE.REJECT, commandId: 'cmd-1', reason: 'not-your-turn' })
    expect(resolve).toHaveBeenCalledExactlyOnceWith({ ok: false, reason: 'not-your-turn' })
  })

  it('ack/reject с неизвестным commandId не падает и никого не задевает', () => {
    const state = new ConnectionState()
    const resolve = vi.fn()
    state.registerPending('cmd-1', resolve)
    expect(() => state.handleServerMessage({ type: SERVER_MESSAGE.ACK, commandId: 'другой' })).not.toThrow()
    expect(resolve).not.toHaveBeenCalled()
  })

  it('rejectAllPending разрешает все ожидающие команды connection-lost и очищает очередь', () => {
    const state = new ConnectionState()
    const a = vi.fn()
    const b = vi.fn()
    state.registerPending('a', a)
    state.registerPending('b', b)

    state.rejectAllPending()
    expect(a).toHaveBeenCalledExactlyOnceWith({ ok: false, reason: 'connection-lost' })
    expect(b).toHaveBeenCalledExactlyOnceWith({ ok: false, reason: 'connection-lost' })

    // повторный вызов не должен снова дёргать уже разрешённые resolver'ы
    a.mockClear()
    b.mockClear()
    state.rejectAllPending()
    expect(a).not.toHaveBeenCalled()
    expect(b).not.toHaveBeenCalled()
  })
})

describe('connectionState: статус соперника и удаление комнаты', () => {
  const update: UpdateMessage = { type: SERVER_MESSAGE.UPDATE, version: 1, events: [], view, legalActions: [], turnTimeLeftMs: null, names, endReason: null }

  it('opponent-status запоминает отключение и отсчёт до сдачи, update их не затирает', () => {
    const state = new ConnectionState()
    state.handleServerMessage(update)
    expect(state.opponentConnected).toBe(true)

    state.handleServerMessage({ type: SERVER_MESSAGE.OPPONENT_STATUS, connected: false, reconnectTimeLeftMs: 60_000 })
    expect(state.opponentConnected).toBe(false)
    expect(state.opponentReconnectTimeLeftMs).toBe(60_000)

    // Автоход по таймауту приходит update'ом, но соперник от этого на связь не вернулся.
    state.handleServerMessage({ ...update, version: 2 })
    expect(state.opponentConnected).toBe(false)

    state.handleServerMessage({ type: SERVER_MESSAGE.OPPONENT_STATUS, connected: true, reconnectTimeLeftMs: null })
    expect(state.opponentConnected).toBe(true)
    expect(state.opponentReconnectTimeLeftMs).toBeNull()
  })

  it('expired выводит из матча, но оставляет причину для лобби', () => {
    const state = new ConnectionState()
    state.handleServerMessage({ type: SERVER_MESSAGE.JOINED, matchId: 'm1', code: 'ABC123', you: 0, token: 't1', opponentConnected: false })
    state.handleServerMessage({ type: SERVER_MESSAGE.ERROR, reason: MATCH_ERROR.EXPIRED })
    expect(state.matchId).toBeNull()
    expect(state.code).toBeNull()
    expect(state.lastError).toBe(MATCH_ERROR.EXPIRED)
  })
})

describe('connectionState: имена и причина конца партии', () => {
  it('update запоминает имена и причину конца, leave их забывает', () => {
    const state = new ConnectionState()
    state.handleServerMessage({ type: SERVER_MESSAGE.UPDATE, version: 1, events: [], view, legalActions: [], turnTimeLeftMs: null, names, endReason: END_REASON.IDLE })
    expect(state.names).toEqual(['Алиса', 'Боб'])
    expect(state.endReason).toBe(END_REASON.IDLE)

    state.leave()
    expect(state.names).toEqual(['', ''])
    expect(state.endReason).toBeNull()
  })
})

describe('connectionState: быстрый поиск', () => {
  it('search-status включает и выключает ожидание, joined его завершает', () => {
    const state = new ConnectionState()
    state.handleServerMessage({ type: SERVER_MESSAGE.SEARCH_STATUS, searching: true })
    expect(state.searching).toBe(true)

    state.handleServerMessage({ type: SERVER_MESSAGE.JOINED, matchId: 'm1', code: 'ABC123', you: 1, token: 't1', opponentConnected: true })
    expect(state.searching).toBe(false)
  })

  it('обрыв связи прекращает поиск: очередь на сервере потеряна', () => {
    const state = new ConnectionState()
    state.handleServerMessage({ type: SERVER_MESSAGE.SEARCH_STATUS, searching: true })
    const resolve = vi.fn()
    state.registerPending('cmd-1', resolve)

    state.handleDisconnected()
    expect(state.searching).toBe(false)
    expect(resolve).toHaveBeenCalledExactlyOnceWith({ ok: false, reason: 'connection-lost' })
  })
})

describe('connectionState: реванш', () => {
  const joined = (matchId: string) => ({ type: SERVER_MESSAGE.JOINED, matchId, code: 'ABC123', you: 0, token: 't', opponentConnected: true }) as const

  it('rematch-status запоминает, кто предложил и возможен ли реванш', () => {
    const state = new ConnectionState()
    state.handleServerMessage({ type: SERVER_MESSAGE.REMATCH_STATUS, you: false, opponent: true, available: true })
    expect(state.rematch).toEqual({ you: false, opponent: true, available: true })
  })

  it('joined с другим matchId забывает прошлую партию, но оставляет подписчиков и возвращает новый токен', () => {
    const state = new ConnectionState()
    const listener = vi.fn()
    state.subscribeUpdates(listener)
    state.handleServerMessage(joined('m1'))
    state.handleServerMessage({ type: SERVER_MESSAGE.UPDATE, version: 9, events: [], view, legalActions: [], turnTimeLeftMs: null, names, endReason: END_REASON.CONCEDE })
    state.handleServerMessage({ type: SERVER_MESSAGE.REMATCH_STATUS, you: true, opponent: true, available: true })
    const resolve = vi.fn()
    state.registerPending('cmd-1', resolve)

    const info = state.handleServerMessage({ ...joined('m2'), token: 't2' })
    expect(info).toEqual({ matchId: 'm2', token: 't2' })
    expect(state.matchId).toBe('m2')
    expect(state.view).toBeNull()
    expect(state.endReason).toBeNull()
    expect(state.rematch).toEqual({ you: false, opponent: false, available: false })
    expect(resolve).toHaveBeenCalledOnce()

    state.handleServerMessage({ type: SERVER_MESSAGE.UPDATE, version: 0, events: [], view, legalActions: [], turnTimeLeftMs: null, names, endReason: null })
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('joined с тем же matchId матч не сбрасывает', () => {
    const state = new ConnectionState()
    state.handleServerMessage(joined('m1'))
    state.handleServerMessage({ type: SERVER_MESSAGE.UPDATE, version: 1, events: [], view, legalActions: [], turnTimeLeftMs: null, names, endReason: null })
    state.handleServerMessage(joined('m1'))
    expect(state.view).toBe(view)
  })
})
