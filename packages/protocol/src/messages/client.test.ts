import { COMMAND_TYPE } from '@space/engine'
import { describe, expect, it } from 'vitest'
import { CLIENT_MESSAGE, parseClientMessage } from './client.ts'

describe('parseClientMessage', () => {
  it('принимает валидные сообщения каждого вида', () => {
    const valid = [
      { type: CLIENT_MESSAGE.CREATE_MATCH },
      { type: CLIENT_MESSAGE.JOIN_MATCH, code: 'ABC123' },
      { type: CLIENT_MESSAGE.RECONNECT, matchId: 'm1', token: 't1' },
      { type: CLIENT_MESSAGE.COMMAND, commandId: 'cmd-1', command: { type: COMMAND_TYPE.END_TURN } },
      { type: CLIENT_MESSAGE.SYNC },
    ]
    for (const message of valid)
      expect(parseClientMessage(JSON.stringify(message))).toEqual(message)
  })

  it('отклоняет невалидный JSON', () => {
    expect(parseClientMessage('{ не json')).toBeNull()
    expect(parseClientMessage('')).toBeNull()
  })

  it('отклоняет неизвестный тип и пустые обязательные поля', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'ping' }))).toBeNull()
    expect(parseClientMessage(JSON.stringify({ type: CLIENT_MESSAGE.JOIN_MATCH, code: '' }))).toBeNull()
    expect(parseClientMessage(JSON.stringify({ type: CLIENT_MESSAGE.COMMAND, commandId: 'c1', command: { type: 'nope' } }))).toBeNull()
  })
})
