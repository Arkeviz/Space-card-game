import { COMMAND_TYPE } from '@space/engine'
import { describe, expect, it } from 'vitest'
import { CLIENT_MESSAGE, CODE_MAX_LENGTH, ID_MAX_LENGTH, parseClientMessage, PLAYER_NAME_MAX_LENGTH, TOKEN_MAX_LENGTH } from './client.ts'

const parse = (message: unknown) => parseClientMessage(JSON.stringify(message))

describe('parseClientMessage', () => {
  it('принимает валидные сообщения каждого вида', () => {
    const valid = [
      { type: CLIENT_MESSAGE.CREATE_MATCH, name: 'Алиса' },
      { type: CLIENT_MESSAGE.JOIN_MATCH, code: 'ABC123', name: 'Боб' },
      { type: CLIENT_MESSAGE.FIND_MATCH, name: 'Алиса' },
      { type: CLIENT_MESSAGE.CANCEL_SEARCH },
      { type: CLIENT_MESSAGE.RECONNECT, matchId: 'm1', token: 't1' },
      { type: CLIENT_MESSAGE.LEAVE_MATCH },
      { type: CLIENT_MESSAGE.REMATCH },
      { type: CLIENT_MESSAGE.COMMAND, commandId: 'cmd-1', command: { type: COMMAND_TYPE.END_TURN } },
      { type: CLIENT_MESSAGE.SYNC },
    ]
    for (const message of valid)
      expect(parse(message)).toEqual(message)
  })

  it('отклоняет невалидный JSON', () => {
    expect(parseClientMessage('{ не json')).toBeNull()
    expect(parseClientMessage('')).toBeNull()
  })

  it('отклоняет неизвестный тип и пустые обязательные поля', () => {
    expect(parse({ type: 'ping' })).toBeNull()
    expect(parse({ type: CLIENT_MESSAGE.JOIN_MATCH, code: '', name: 'Боб' })).toBeNull()
    expect(parse({ type: CLIENT_MESSAGE.COMMAND, commandId: 'c1', command: { type: 'nope' } })).toBeNull()
  })

  it('служебные строки длиннее предела отклоняются, ровно предел принимается', () => {
    const join = (code: string) => parse({ type: CLIENT_MESSAGE.JOIN_MATCH, code, name: 'Боб' })
    const reconnect = (matchId: string, token: string) => parse({ type: CLIENT_MESSAGE.RECONNECT, matchId, token })
    const command = (commandId: string) => parse({ type: CLIENT_MESSAGE.COMMAND, commandId, command: { type: COMMAND_TYPE.END_TURN } })

    expect(join('A'.repeat(CODE_MAX_LENGTH))).not.toBeNull()
    expect(join('A'.repeat(CODE_MAX_LENGTH + 1))).toBeNull()
    expect(reconnect('m'.repeat(ID_MAX_LENGTH), 't'.repeat(TOKEN_MAX_LENGTH))).not.toBeNull()
    expect(reconnect('m'.repeat(ID_MAX_LENGTH + 1), 't')).toBeNull()
    expect(reconnect('m', 't'.repeat(TOKEN_MAX_LENGTH + 1))).toBeNull()
    expect(command('c'.repeat(ID_MAX_LENGTH))).not.toBeNull()
    expect(command('c'.repeat(ID_MAX_LENGTH + 1))).toBeNull()
  })
})

describe('имя игрока', () => {
  const create = (name: unknown) => parse({ type: CLIENT_MESSAGE.CREATE_MATCH, name })

  it('обязательно: без имени сообщение отклоняется', () => {
    expect(parse({ type: CLIENT_MESSAGE.CREATE_MATCH })).toBeNull()
    expect(parse({ type: CLIENT_MESSAGE.FIND_MATCH })).toBeNull()
    expect(parse({ type: CLIENT_MESSAGE.JOIN_MATCH, code: 'ABC123' })).toBeNull()
  })

  it('пробелы по краям обрезаются, пустое и состоящее из пробелов имя отклоняется', () => {
    expect(create('  Алиса  ')).toEqual({ type: CLIENT_MESSAGE.CREATE_MATCH, name: 'Алиса' })
    expect(create('')).toBeNull()
    expect(create('   ')).toBeNull()
  })

  it('длиннее предела отклоняется, ровно предел принимается', () => {
    expect(create('я'.repeat(PLAYER_NAME_MAX_LENGTH))).not.toBeNull()
    expect(create('я'.repeat(PLAYER_NAME_MAX_LENGTH + 1))).toBeNull()
  })

  it('управляющие и невидимые символы отклоняются', () => {
    expect(create('Али\nса')).toBeNull()
    expect(create('Али\u0000са')).toBeNull()
    expect(create('Али​са')).toBeNull()
  })

  it('не строка отклоняется', () => {
    expect(create(42)).toBeNull()
    expect(create(null)).toBeNull()
  })
})
