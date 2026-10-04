import type { PlayerView } from '@space/engine'
import type { UpdateMessage } from '@space/protocol'
import { COMMAND_TYPE } from '@space/engine'
import { MATCH_ERROR, SERVER_MESSAGE } from '@space/protocol'
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
    const update: UpdateMessage = { type: SERVER_MESSAGE.UPDATE, version: 2, events: [], view, legalActions: [], turnTimeLeftMs: 5000 }
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
    state.handleServerMessage({ type: SERVER_MESSAGE.UPDATE, version: 1, events: [], view, legalActions: [], turnTimeLeftMs: null })
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
