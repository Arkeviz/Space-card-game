import type { Command, GameEvent, PlayerView } from '@space/engine'
import type { TableState } from '../../table'
import { buildTable, reduceEvent } from '../../table'
import { beatFor, groupEvents } from './groups'
import { introEvents, introStartTable, isFreshGame } from './intro'

/** Один update сервера: события и итоговое состояние после них. */
export interface DirectorUpdate {
  version: number
  events: GameEvent[]
  view: PlayerView
  legalActions: Command[]
  turnTimeLeftMs: number | null
  /** Когда update пришёл (Date.now()): от этого момента отсчитывается turnTimeLeftMs, а не от конца анимации. */
  receivedAt?: number
  /** Это ответ на команду самого игрока: он уже знает, что сделал, поэтому показываем быстрее. */
  own?: boolean
}

/** Что директору нужно от слоя карт. Реализуется Board'ом; в тестах подменяется заглушкой. */
export interface DirectorStage<M = unknown> {
  setMotion: (motion: M) => void
  snapNext: () => void
  settled: () => Promise<void>
}

export interface DirectorHost<M = unknown> {
  stage: DirectorStage<M>
  getTable: () => TableState | null
  setTable: (table: TableState) => void
  /** Подсказки движения для группы событий (геометрия слоя карт). */
  motionFor: (group: readonly GameEvent[], before: TableState) => M
  /**
   * Вызывается, когда группа событий применена к столу: журнал, числа, вспышки. Возвращённый промис
   * дожидается вместе с анимацией карт.
   */
  onStep?: (group: readonly GameEvent[], before: TableState, after: TableState) => Promise<void> | void
  /** Update целиком проигран: можно принимать ввод и показывать новые legalActions. */
  onUpdateDone: (update: DirectorUpdate) => void
  /** Начался/закончился проигрыш очереди: пока busy, ввод закрыт. */
  onBusyChange?: (busy: boolean) => void
  /** Множитель скорости: растёт, когда очередь накапливается. */
  onSpeedChange?: (speed: number) => void
  wait?: (ms: number) => Promise<void>
}

/** Если анимация зависла (вкладка в фоне, ошибка в слое), шаг всё равно закрывается через это время. */
const MAX_STEP_MS = 4000
/** Очередь длиннее - значит, клиент отстаёт от сервера: ускоряем. */
const CATCH_UP_QUEUE = 2
const CATCH_UP_SPEED = 2.5
/** Ответ на собственную команду: ввод закрыт, пока он играется, поэтому не задерживаем игрока. */
const OWN_ACTION_SPEED = 2

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Очередь событий: каждое событие применяется к «нарисованному» столу маленьким чистым редьюсером, слой карт
 * анимирует результат, и только когда очередь опустела, стол сверяется с серверным состоянием.
 * Ввод открыт, только пока очередь пуста.
 */
export class AnimationDirector<M = unknown> {
  private readonly queue: DirectorUpdate[] = []
  private running = false
  /** Растёт при каждой принудительной синхронизации: проигрыш устаревшего update прерывается. */
  private epoch = 0
  /** Множитель скорости текущего update: длительность пауз между шагами делится на него. */
  private speed = 1
  private readonly host: DirectorHost<M>
  private readonly wait: (ms: number) => Promise<void>

  constructor(host: DirectorHost<M>) {
    this.host = host
    this.wait = host.wait ?? sleep
  }

  get busy(): boolean {
    return this.running
  }

  /** Вход в матч или полная синхронизация: стол ставится как есть, без анимации. Очередь сбрасывается. */
  snapTo(update: DirectorUpdate): void {
    this.queue.length = 0
    this.epoch += 1
    this.host.stage.snapNext()
    this.host.setTable(buildTable(update.view))
    this.host.onUpdateDone(update)
  }

  /** Начало партии: розданные руки не появляются из ниоткуда, а раздаются из колод. */
  begin(update: DirectorUpdate): void {
    const table = buildTable(update.view)
    if (!isFreshGame(table)) {
      this.snapTo(update)
      return
    }
    this.queue.length = 0
    this.epoch += 1
    this.host.stage.snapNext()
    this.host.setTable(introStartTable(table))
    this.enqueue({ ...update, events: introEvents(table) })
  }

  enqueue(update: DirectorUpdate): void {
    this.queue.push(update)
    this.run()
  }

  private async run(): Promise<void> {
    if (this.running)
      return
    this.running = true
    this.host.onBusyChange?.(true)
    try {
      while (this.queue.length > 0) {
        const next = this.queue.shift()!
        this.speed = this.queue.length >= CATCH_UP_QUEUE - 1 ? CATCH_UP_SPEED : (next.own ? OWN_ACTION_SPEED : 1)
        this.host.onSpeedChange?.(this.speed)
        await this.play(next)
      }
    }
    finally {
      this.running = false
      this.speed = 1
      this.host.onSpeedChange?.(1)
      this.host.onBusyChange?.(false)
    }
  }

  private async play(update: DirectorUpdate): Promise<void> {
    const { host } = this
    const { epoch } = this
    let table = host.getTable() ?? buildTable(update.view)

    for (const group of groupEvents(update.events)) {
      try {
        const before = table
        const after = group.reduce(reduceEvent, before)
        host.stage.setMotion(host.motionFor(group, before))
        host.setTable(after)
        table = after
        await Promise.race([
          Promise.all([host.stage.settled(), host.onStep?.(group, before, after), this.wait(beatFor(group) / this.speed)]),
          this.wait(MAX_STEP_MS),
        ])
        // Пока шёл шаг, пришла полная синхронизация: этот update устарел, стол уже поставлен по новому снимку.
        if (epoch !== this.epoch)
          return
      }
      catch (error) {
        // Сбой анимации не должен ломать партию: показываем серверное состояние как есть.
        console.error('Сбой анимации события, стол синхронизируется со снимком сервера', error)
        break
      }
    }

    const server = buildTable(update.view)
    if (JSON.stringify(table) !== JSON.stringify(server)) {
      host.stage.snapNext()
      host.setTable(server)
    }
    host.onUpdateDone(update)
  }
}
