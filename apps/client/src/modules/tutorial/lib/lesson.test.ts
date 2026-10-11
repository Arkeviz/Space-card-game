import type { Command } from '@space/engine'
import type { LessonStep } from './lesson-types'
import type { MatchUpdate } from '@/modules/match'
import { COMMAND_TYPE } from '@space/engine'
import { describe, expect, it } from 'vitest'
import { createLessonGame } from './lesson-game'
import { LESSON_STEPS } from './lesson-steps'
import { STEP_KIND } from './lesson-types'
import { TutorialSession } from './session'

const instant = (): Promise<void> => Promise.resolve()

function newSession(): TutorialSession {
  return new TutorialSession(createLessonGame(), LESSON_STEPS, { sleep: instant })
}

type Picker = (allowed: Command[], session: TutorialSession) => Command

const first: Picker = allowed => allowed[0]!

/** Играет шаги подряд, пока не дойдёт до последнего, и возвращает id пройденных шагов. */
async function playThrough(session: TutorialSession, pick: Picker = first, until?: string): Promise<string[]> {
  const visited: string[] = []
  for (let guard = 0; guard < 500; guard++) {
    const { step } = session
    if (until && step.id === until)
      return visited
    if (visited.at(-1) !== step.id)
      visited.push(step.id)
    if (step.kind === STEP_KIND.INFO) {
      if (!session.next())
        return visited
    }
    else if (step.kind === STEP_KIND.ACT) {
      const allowed = session.allowedActions()
      expect(allowed.length, `на шаге «${step.id}» нечего делать`).toBeGreaterThan(0)
      const outcome = await session.transport.submitCommand(pick(allowed, session))
      expect(outcome, `шаг «${step.id}»`).toEqual({ ok: true })
    }
    else {
      await session.whenAutoDone()
    }
  }
  throw new Error('Сценарий не закончился')
}

/** Порядок розыгрыша карт первого хода: из разрешённых PLAY_CARD берём карту с нужным cardId. */
function playOrder(order: string[]): Picker {
  const queue = [...order]
  return (allowed, session) => {
    const { state } = { state: session.gameState }
    if (session.step.id === 'play-first' || session.step.id === 'play-rest') {
      const wanted = queue.shift()!
      return allowed.find(command => command.type === COMMAND_TYPE.PLAY_CARD && state.players[0].hand.find(card => card.id === command.cardId)?.cardId === wanted)!
    }
    return allowed[0]!
  }
}

describe('обучение', () => {
  it('проходится от начала до конца: каждый шаг выполним, цель подсказки находится', async () => {
    const session = newSession()
    const visited: string[] = []
    const targets: Record<string, unknown> = {}
    const unsubscribe = session.onStepChange(() => {
      targets[session.step.id] = session.resolve().target
    })
    visited.push(...await playThrough(session))
    unsubscribe()

    expect(visited.at(0)).toBe('welcome')
    expect(visited.at(-1)).toBe('outro')
    expect(visited).toContain('destroy-outpost')
    // Подсказки с привязкой к карте находят карту в партии; без привязки (приветствие, итог) цели нет.
    for (const id of ['play-first', 'buy', 'buy-base', 'play-base', 'activate-base', 'ally', 'destroy-outpost'])
      expect(targets[id], id).toEqual(expect.stringContaining('data-key'))
  })

  it('в конце соперник без аванпоста и с потерянным авторитетом, игрок получил бонусы Катера', async () => {
    const session = newSession()
    await playThrough(session)
    const { players } = session.gameState
    expect(players[1].authority).toBe(48)
    expect(players[1].inPlay).toEqual([])
    expect(players[1].discard.map(card => card.cardId)).toContain('recycling-station')
    // 50 - 2 (удар соперника) + 4 (Катер); бонус базы зависит от выбора игрока.
    expect(players[0].authority).toBeGreaterThanOrEqual(52)
    expect(session.gameState.winner).toBeNull()
  })

  it('при любом порядке розыгрыша первой руки к 5-му ходу возвращаются Катер и Рыночный мир', async () => {
    const orders = [
      ['scout', 'scout', 'viper'],
      ['scout', 'viper', 'scout'],
      ['viper', 'scout', 'scout'],
    ]
    for (const order of orders) {
      const session = newSession()
      await playThrough(session, playOrder(order), 'turn-5')
      const hand = session.gameState.players[0].hand.map(card => card.cardId).sort()
      // Если не так, генератор случайных чисел или порядок сброса изменились: подберите LESSON_RNG_STATE заново (lesson-game.ts).
      expect(hand, order.join()).toEqual(['barter-world', 'cutter', 'scout', 'scout', 'viper'])
    }
  })

  it('принимает только команды текущего шага', async () => {
    const session = newSession()
    const { submitCommand } = session.transport
    // На информационном шаге игра стоит.
    expect(await submitCommand({ type: COMMAND_TYPE.END_TURN })).toEqual({ ok: false, reason: 'not-allowed' })

    await playThrough(session, first, 'play-first')
    const hand = session.gameState.players[0].hand
    const row = session.gameState.tradeRow[1]!
    expect(await submitCommand({ type: COMMAND_TYPE.BUY, cardId: row.id })).toEqual({ ok: false, reason: 'not-allowed' })
    expect(await submitCommand({ type: COMMAND_TYPE.END_TURN })).toEqual({ ok: false, reason: 'not-allowed' })
    expect(await submitCommand({ type: COMMAND_TYPE.CONCEDE })).toEqual({ ok: false, reason: 'not-allowed' })
    expect(await submitCommand({ type: COMMAND_TYPE.PLAY_CARD, cardId: hand[0]!.id })).toEqual({ ok: true })
  })

  it('отдаёт экрану только разрешённые шагом команды', async () => {
    const session = newSession()
    await playThrough(session, first, 'buy')
    const update = session.transport.snapshot()!
    expect(update.legalActions).toHaveLength(1)
    expect(update.legalActions[0]).toMatchObject({ type: COMMAND_TYPE.BUY })
    expect(update.turnTimeLeftMs).toBeNull()
    expect(update.view.you).toBe(0)
  })

  it('шлёт экрану список команд, когда шаг сменился без хода в партии, и не шлёт лишнего', async () => {
    const session = newSession()
    const updates: MatchUpdate[] = []
    session.transport.onUpdate(update => updates.push(update))

    // welcome -> ... -> pools: информационные шаги, команд нет, обновлений тоже.
    await playThrough(session, first, 'pools')
    expect(updates).toEqual([])
    session.next()

    // Следующий шаг («play-first») открывает игроку ввод: приходит update без событий и с той же версией партии.
    expect(session.step.id).toBe('play-first')
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ version: 0, events: [] })
    expect(updates[0]!.legalActions.length).toBeGreaterThan(0)
  })

  it('соперник ходит по записи: события приходят отдельными update, версия растёт на единицу', async () => {
    const session = newSession()
    const updates: MatchUpdate[] = []
    session.transport.onUpdate(update => updates.push(update))
    await playThrough(session, first, 'turn-3')

    const versions = updates.map(update => update.version)
    expect(versions).toEqual(versions.toSorted((a, b) => a - b))
    const opponentUpdates = updates.filter(update => update.events.length > 0).slice(-8)
    expect(opponentUpdates).toHaveLength(8)
    // Скрытое от игрока скрыто: рука соперника в снимке - только число карт.
    expect(updates.at(-1)!.view.opponent).not.toHaveProperty('hand')
  })

  it('каждый шаг сценария описан полностью', () => {
    const ids = new Set<string>()
    for (const step of LESSON_STEPS as readonly LessonStep[]) {
      expect(ids.has(step.id), `повтор id «${step.id}»`).toBe(false)
      ids.add(step.id)
      expect(step.title.length).toBeGreaterThan(0)
      expect(step.text).not.toContain('—')
    }
    expect(LESSON_STEPS.at(-1)!.kind).toBe(STEP_KIND.INFO)
  })
})
