import type { Command, GameState } from '@space/engine'
import type { LessonStep, TargetSpec } from './lesson-types'
import type { Box, TourSide } from '@/common/utilities/tour-placement'
import type { CommandOutcome, MatchTransport, MatchUpdate } from '@/modules/match'
import { apply, COMMAND_TYPE, legalActions, redact, redactEvents } from '@space/engine'
import { STEP_KIND } from './lesson-types'

/** Игрок в учебной партии всегда на месте 0 (ходит первым), записанный соперник - на месте 1. */
const ME = 0
const OPPONENT = 1

/** Пауза перед первым ходом соперника и между его ходами, мс. Дальше шаг ждёт, пока доиграют анимации. */
const AUTO_START_MS = 700
const AUTO_GAP_MS = 450
/** После отправки хода соперника даём директору анимаций время занять очередь, прежде чем проверять, что он свободен. */
const AUTO_SETTLE_MS = 120

export interface SessionOptions {
  /** Промис, который выполняется, когда экран матча доиграл анимации. Без него шаги соперника идут по таймеру. */
  whenIdle?: () => Promise<unknown>
  sleep?: (ms: number) => Promise<void>
}

/** Подсказка текущего шага в виде, готовом для окна тура. */
export interface ResolvedStep {
  id: string
  kind: LessonStep['kind']
  title: string
  description: string
  target: string | Box | null
  side: TourSide | undefined
  /** Номер шага (с 1) и общее число шагов - для индикатора. */
  number: number
  total: number
  canPrev: boolean
  canNext: boolean
  nextLabel: string
  /** Последний шаг: после «Далее» обучение заканчивается. */
  last: boolean
}

const defaultSleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

const sameCommand = (a: Command, b: Command): boolean => JSON.stringify(a) === JSON.stringify(b)

/**
 * Учебная партия: настоящий движок на клиенте и сценарий поверх него. Сессия играет роль сервера для экрана матча
 * (MatchTransport): принимает команды игрока, применяет их движком, рассылает update'ы. Игроку разрешены только те
 * команды, которые нужны текущему шагу, поэтому партия идёт ровно по сценарию. Ходы соперника записаны в шагах AUTO.
 * Никакой сети и случайности: одна и та же последовательность команд всегда даёт одну и ту же партию.
 */
export class TutorialSession {
  private state: GameState
  private index = 0
  private disposed = false
  /** Растёт при каждом запуске записанного хода: устаревший цикл (после dispose) прекращается. */
  private autoRun = 0
  private autoDone: Promise<void> = Promise.resolve()
  private lastLegalKey = ''
  private readonly listeners = new Set<(update: MatchUpdate) => void>()
  private readonly stepListeners = new Set<() => void>()
  private readonly sleep: (ms: number) => Promise<void>
  private readonly steps: readonly LessonStep[]
  private readonly options: SessionOptions

  constructor(initial: GameState, steps: readonly LessonStep[], options: SessionOptions = {}) {
    this.state = initial
    this.steps = steps
    this.options = options
    this.sleep = options.sleep ?? defaultSleep
    this.index = this.firstIndexFrom(0)
    this.lastLegalKey = JSON.stringify(this.allowedActions())
  }

  /** Подключение для экрана матча. */
  readonly transport: MatchTransport = {
    snapshot: () => this.update([]),
    onUpdate: (listener) => {
      this.listeners.add(listener)
      return () => this.listeners.delete(listener)
    },
    submitCommand: command => Promise.resolve(this.submit(command)),
  }

  get step(): LessonStep {
    return this.steps[this.index]!
  }

  get gameState(): GameState {
    return this.state
  }

  /** Резолвит текущий шаг: цель подсказки может зависеть от партии (id карт). */
  resolve(): ResolvedStep {
    const { step } = this
    const info = step.kind === STEP_KIND.INFO
    return {
      id: step.id,
      kind: step.kind,
      title: step.title,
      description: step.text,
      target: this.resolveTarget(step.target),
      side: step.side,
      number: this.index + 1,
      total: this.steps.length,
      canPrev: info && this.index > 0 && this.steps[this.index - 1]!.kind === STEP_KIND.INFO,
      canNext: info,
      nextLabel: info ? (step.nextLabel ?? 'Далее') : '',
      last: this.index === this.steps.length - 1,
    }
  }

  onStepChange(listener: () => void): () => void {
    this.stepListeners.add(listener)
    return () => this.stepListeners.delete(listener)
  }

  /** «Далее» на информационном шаге. Возвращает false, если это был последний шаг (обучение пройдено). */
  next(): boolean {
    if (this.step.kind !== STEP_KIND.INFO)
      return true
    if (this.index === this.steps.length - 1)
      return false
    this.enter(this.index + 1)
    return true
  }

  prev(): void {
    if (this.resolve().canPrev)
      this.enter(this.index - 1)
  }

  /** Для тестов: промис, который выполняется, когда записанные ходы соперника закончились. */
  whenAutoDone(): Promise<void> {
    return this.autoDone
  }

  dispose(): void {
    this.disposed = true
    this.autoRun += 1
    this.listeners.clear()
    this.stepListeners.clear()
  }

  /** Команды игрока, которые шаг сейчас разрешает (подмножество legalActions движка). */
  allowedActions(): Command[] {
    const { step, state } = this
    if (step.kind !== STEP_KIND.ACT)
      return []
    return legalActions(state, ME).filter(command => step.allow(command, state))
  }

  private resolveTarget(spec: TargetSpec | undefined): string | Box | null {
    if (spec === undefined)
      return null
    return typeof spec === 'function' ? spec(this.state) : spec
  }

  private firstIndexFrom(start: number): number {
    let index = start
    while (index < this.steps.length - 1 && this.steps[index]!.skipIf?.(this.state))
      index++
    return index
  }

  /** Переход к шагу. Если у нового шага другой набор разрешённых команд, экран получает его отдельным update'ом. */
  private enter(index: number, willEmit = false): void {
    this.index = this.firstIndexFrom(index)
    for (const listener of this.stepListeners)
      listener()
    if (this.step.kind === STEP_KIND.AUTO)
      this.autoDone = this.runAuto(this.step)
    if (!willEmit)
      this.refreshLegal()
  }

  private submit(command: Command): CommandOutcome {
    if (this.disposed || command.type === COMMAND_TYPE.CONCEDE)
      return { ok: false, reason: 'not-allowed' }
    const { step } = this
    if (step.kind !== STEP_KIND.ACT || !this.allowedActions().some(allowed => sameCommand(allowed, command)))
      return { ok: false, reason: 'not-allowed' }

    const result = apply(this.state, ME, command)
    if (!result.ok)
      return { ok: false, reason: result.error }
    this.state = result.state
    if (!step.until || step.until(this.state))
      this.enter(this.index + 1, true)
    this.emit(result.events)
    return { ok: true }
  }

  /** Записанные ходы соперника по одному, каждый - после того, как экран доиграл предыдущий. */
  private async runAuto(step: Extract<LessonStep, { kind: typeof STEP_KIND.AUTO }>): Promise<void> {
    const run = ++this.autoRun
    const stopped = (): boolean => this.disposed || run !== this.autoRun
    await this.sleep(AUTO_START_MS)
    for (const [position, move] of step.moves.entries()) {
      await this.options.whenIdle?.()
      if (stopped())
        return
      const command = move(this.state)
      const result = apply(this.state, OPPONENT, command)
      if (!result.ok)
        throw new Error(`Сценарий обучения: ход соперника ${command.type} отклонён движком (${result.error})`)
      this.state = result.state
      const isLast = position === step.moves.length - 1
      if (isLast)
        this.enter(this.index + 1, true)
      this.emit(result.events)
      if (isLast)
        return
      await this.sleep(AUTO_SETTLE_MS)
      await this.options.whenIdle?.()
      await this.sleep(AUTO_GAP_MS)
    }
  }

  private update(events: MatchUpdate['events']): MatchUpdate {
    const { state } = this
    return {
      version: state.version,
      events: redactEvents(events, ME),
      view: redact(state, ME),
      legalActions: this.allowedActions(),
      turnTimeLeftMs: null,
      receivedAt: Date.now(),
    }
  }

  private emit(events: MatchUpdate['events']): void {
    const update = this.update(events)
    this.lastLegalKey = JSON.stringify(update.legalActions)
    for (const listener of this.listeners)
      listener(update)
  }

  /** Состояние партии не изменилось, но шаг разрешает другие команды: экрану нужен свежий список. */
  private refreshLegal(): void {
    if (JSON.stringify(this.allowedActions()) !== this.lastLegalKey)
      this.emit([])
  }
}
