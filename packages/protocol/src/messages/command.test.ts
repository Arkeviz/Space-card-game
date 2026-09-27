import { ABILITY_KIND, COMMAND_TYPE } from '@space/engine'
import { describe, expect, it } from 'vitest'
import { parseCommand } from './command.ts'

describe('parseCommand', () => {
  it('принимает валидные команды каждого вида', () => {
    const valid = [
      { type: COMMAND_TYPE.PLAY_CARD, cardId: 'c1' },
      { type: COMMAND_TYPE.BUY, cardId: 'c1' },
      { type: COMMAND_TYPE.BUY_EXPLORER },
      { type: COMMAND_TYPE.ACTIVATE, cardId: 'c1', ability: ABILITY_KIND.SCRAP },
      { type: COMMAND_TYPE.ATTACK_PLAYER, amount: 3 },
      { type: COMMAND_TYPE.ATTACK_BASE, cardId: 'c1' },
      { type: COMMAND_TYPE.CHOOSE_OPTION, promptId: 1, index: 0 },
      { type: COMMAND_TYPE.CHOOSE_CARD, promptId: 1, cardId: 'c1' },
      { type: COMMAND_TYPE.SKIP, promptId: 1 },
      { type: COMMAND_TYPE.END_TURN },
      { type: COMMAND_TYPE.CONCEDE },
    ]
    for (const command of valid)
      expect(parseCommand(command)).toEqual(command)
  })

  it('отклоняет неизвестный тип, отсутствующие и лишние поля, мусор', () => {
    const invalid: unknown[] = [
      { type: 'NOT_A_COMMAND' },
      { type: COMMAND_TYPE.PLAY_CARD },
      { type: COMMAND_TYPE.BUY, cardId: '' },
      { type: COMMAND_TYPE.ATTACK_PLAYER, amount: 0 },
      { type: COMMAND_TYPE.ATTACK_PLAYER, amount: 1.5 },
      { type: COMMAND_TYPE.ATTACK_PLAYER, amount: '3' },
      { type: COMMAND_TYPE.SKIP, promptId: 0 },
      { type: COMMAND_TYPE.ACTIVATE, cardId: 'c1', ability: 'evil' },
      null,
      undefined,
      'END_TURN',
      42,
      [],
    ]
    for (const command of invalid)
      expect(parseCommand(command)).toBeNull()
  })

  it('не пропускает через end_turn лишние поля молча', () => {
    // valibot v.object по умолчанию отбрасывает неизвестные ключи - фиксируем это поведение явно.
    expect(parseCommand({ type: COMMAND_TYPE.END_TURN, extra: 'x' })).toEqual({ type: COMMAND_TYPE.END_TURN })
  })
})
