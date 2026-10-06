import type { GameEvent } from '@space/engine'
import type { TableState } from '../../table'
import type { DirectorHost, DirectorUpdate } from './director'
import { apply, COMMAND_TYPE, createGame, legalActions, redact, redactEvents } from '@space/engine'
import { describe, expect, it } from 'vitest'
import { buildTable } from '../../table'
import { AnimationDirector } from './director'
import { groupEvents } from './groups'

function setup() {
  const state = createGame(11, { firstPlayer: 0 })
  const log: string[] = []
  let table: TableState | null = null
  const resolvers: (() => void)[] = []
  let hold = false

  const host: DirectorHost<string> = {
    stage: {
      setMotion: () => log.push('motion'),
      snapNext: () => log.push('snap'),
      settled: () => (hold ? new Promise<void>(resolve => resolvers.push(resolve)) : Promise.resolve()),
    },
    getTable: () => table,
    setTable: (next) => {
      table = next
      log.push('table')
    },
    motionFor: () => 'm',
    onStep: (group) => {
      log.push(`step:${group[0]!.type}x${group.length}`)
    },
    onUpdateDone: (update) => {
      log.push(`done:${update.version}`)
    },
    onBusyChange: (busy) => {
      log.push(busy ? 'busy' : 'idle')
    },
    // Длинное ожидание (страховочный таймаут шага) в тесте не срабатывает: иначе оно перебило бы удерживаемую анимацию.
    wait: ms => (ms >= 1000 ? new Promise<void>(() => {}) : Promise.resolve()),
  }
  return {
    state,
    log,
    host,
    get table() { return table },
    holdAnimations(value: boolean) { hold = value },
    release() { resolvers.splice(0).forEach(resolve => resolve()) },
  }
}

function updateFrom(state: ReturnType<typeof createGame>, viewer: 0 | 1, events: GameEvent[]): DirectorUpdate {
  return { version: state.version, events: redactEvents(events, viewer), view: redact(state, viewer), legalActions: legalActions(state, viewer), turnTimeLeftMs: 90_000 }
}

describe('animationDirector', () => {
  it('проигрывает события группами и в конце сверяет стол со снимком сервера', async () => {
    const t = setup()
    const director = new AnimationDirector(t.host)
    const first = createGame(11, { firstPlayer: 0 })
    director.snapTo(updateFrom(first, 0, []))
    t.log.length = 0

    const result = apply(first, 0, { type: COMMAND_TYPE.END_TURN })
    if (!result.ok)
      throw new Error('END_TURN отклонён')
    director.enqueue(updateFrom(result.state, 0, result.events))
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(t.log[0]).toBe('busy')
    expect(t.log.at(-1)).toBe('idle')
    expect(t.log).toContain(`done:${result.state.version}`)
    expect(t.log.filter(entry => entry.startsWith('step:card-discardedx'))).toHaveLength(1)
    expect(t.table).toEqual(buildTable(redact(result.state, 0)))
  })

  it('ответ на собственную команду проигрывается быстрее: паузы между шагами короче', async () => {
    const waits: Record<string, number[]> = { normal: [], own: [] }
    for (const mode of ['normal', 'own'] as const) {
      const t = setup()
      const director = new AnimationDirector({ ...t.host, wait: (ms) => {
        waits[mode]!.push(ms)
        return Promise.resolve()
      } })
      const state0 = createGame(11, { firstPlayer: 0 })
      director.snapTo(updateFrom(state0, 0, []))
      const result = apply(state0, 0, { type: COMMAND_TYPE.END_TURN })
      if (!result.ok)
        throw new Error('END_TURN отклонён')
      director.enqueue({ ...updateFrom(result.state, 0, result.events), own: mode === 'own' })
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    const longest = (list: number[]): number => Math.max(...list.filter(ms => ms < 1000))
    expect(longest(waits.own!)).toBeLessThan(longest(waits.normal!))
  })

  it('настройка скорости анимаций делит паузы между шагами и читается на каждом шаге', async () => {
    const waits: Record<string, number[]> = { slow: [], fast: [] }
    const factors = { slow: 0.5, fast: 2 }
    for (const mode of ['slow', 'fast'] as const) {
      const t = setup()
      const director = new AnimationDirector({ ...t.host, speedFactor: () => factors[mode], wait: (ms) => {
        waits[mode]!.push(ms)
        return Promise.resolve()
      } })
      const state0 = createGame(11, { firstPlayer: 0 })
      director.snapTo(updateFrom(state0, 0, []))
      const result = apply(state0, 0, { type: COMMAND_TYPE.END_TURN })
      if (!result.ok)
        throw new Error('END_TURN отклонён')
      director.enqueue(updateFrom(result.state, 0, result.events))
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    // 4000 мс - аварийный таймаут шага, он от скорости не зависит.
    const longest = (list: number[]): number => Math.max(...list.filter(ms => ms < 4000))
    // Пауза пропорциональна 1 / factor: при 0.5 она в четыре раза длиннее, чем при 2.
    expect(longest(waits.slow!)).toBeCloseTo(longest(waits.fast!) * 4)
  })

  it('второй update ждёт, пока доиграет первый', async () => {
    const t = setup()
    const director = new AnimationDirector(t.host)
    const state0 = createGame(11, { firstPlayer: 0 })
    director.snapTo(updateFrom(state0, 0, []))
    t.log.length = 0

    const r1 = apply(state0, 0, { type: COMMAND_TYPE.END_TURN })
    if (!r1.ok)
      throw new Error('END_TURN отклонён')
    const r2 = apply(r1.state, 1, { type: COMMAND_TYPE.END_TURN })
    if (!r2.ok)
      throw new Error('END_TURN отклонён')

    t.holdAnimations(true)
    director.enqueue(updateFrom(r1.state, 0, r1.events))
    director.enqueue(updateFrom(r2.state, 0, r2.events))
    await new Promise(resolve => setTimeout(resolve, 5))
    expect(t.log).not.toContain(`done:${r1.state.version}`)

    t.holdAnimations(false)
    t.release()
    await new Promise(resolve => setTimeout(resolve, 20))
    const done = t.log.filter(entry => entry.startsWith('done:'))
    expect(done).toEqual([`done:${r1.state.version}`, `done:${r2.state.version}`])
  })

  it('разошедшийся стол принудительно сверяется со снимком сервера', async () => {
    const t = setup()
    const director = new AnimationDirector(t.host)
    const state0 = createGame(11, { firstPlayer: 0 })
    director.snapTo(updateFrom(state0, 0, []))

    const r1 = apply(state0, 0, { type: COMMAND_TYPE.END_TURN })
    if (!r1.ok)
      throw new Error('END_TURN отклонён')
    // События потеряны (например, пропущена версия): стол остаётся старым, но снимок новый.
    director.enqueue({ ...updateFrom(r1.state, 0, []), events: [] })
    await new Promise(resolve => setTimeout(resolve, 5))
    expect(t.table).toEqual(buildTable(redact(r1.state, 0)))
  })

  it('begin: в начале партии руки раздаются из колод, мид-гейм входит без анимации', async () => {
    const fresh = setup()
    const director = new AnimationDirector(fresh.host)
    const state = createGame(11, { firstPlayer: 0 })
    director.begin(updateFrom(state, 0, []))
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(fresh.log.some(entry => entry.startsWith('step:cards-drawnx'))).toBe(true)
    expect(fresh.table).toEqual(buildTable(redact(state, 0)))

    const mid = setup()
    const midDirector = new AnimationDirector(mid.host)
    const played = apply(state, 0, { type: COMMAND_TYPE.END_TURN })
    if (!played.ok)
      throw new Error('END_TURN отклонён')
    midDirector.begin(updateFrom(played.state, 0, []))
    expect(mid.log.some(entry => entry.startsWith('step:'))).toBe(false)
    expect(mid.table).toEqual(buildTable(redact(played.state, 0)))
  })
})

describe('groupEvents', () => {
  it('склеивает подряд идущие однотипные события карт и ресурсов, остальные оставляет по одному', () => {
    const card = { id: 'a', cardId: 'scout' }
    const groups = groupEvents([
      { type: 'card-discarded', player: 0, card, from: 'hand' },
      { type: 'card-discarded', player: 0, card, from: 'hand' },
      { type: 'cards-drawn', player: 0, count: 2 },
      { type: 'cards-drawn', player: 0, count: 3 },
      { type: 'turn-started', player: 1, turn: 2 },
      { type: 'turn-started', player: 0, turn: 3 },
    ])
    expect(groups.map(group => group.length)).toEqual([2, 2, 1, 1])
  })
})
