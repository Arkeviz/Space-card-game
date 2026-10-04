import type { Command, CommandError } from '@space/engine'
import type { DirectorStage, DirectorUpdate } from '../modules/animation-director'
import type { Motion } from '../modules/board'
import type { FxItem, LogEntry, TurnBanner } from '../modules/hud'
import type { TableState } from '../modules/table'
import { COMMAND_ERROR, COMMAND_TYPE, EVENT_TYPE } from '@space/engine'
import { until } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { AnimationDirector, introStartTable, isFreshGame } from '../modules/animation-director'
import { motionFor } from '../modules/board'
import { BANNER_LIFETIME_MS, describeStep, FX_LIFETIME_MS } from '../modules/hud'
import { buildTable, indexLegalActions, nextCardToPlay } from '../modules/table'

/** Результат отправки команды. reason - код ошибки движка или 'connection-lost'. */
export type CommandOutcome = { ok: true } | { ok: false, reason: CommandError | 'connection-lost' }

/**
 * Всё, что экрану матча нужно от подключения. Передаётся снаружи (IoC): модуль match не знает ни о WebSocket,
 * ни о модуле connection - страница сопоставляет их друг с другом.
 */
export interface MatchTransport {
  /** Последний известный снимок состояния (с пустым списком событий) или null, если матч ещё не начался. */
  snapshot: () => DirectorUpdate | null
  /** Подписка на каждый следующий update. Возвращает отписку. */
  onUpdate: (listener: (update: DirectorUpdate) => void) => () => void
  submitCommand: (command: Command) => Promise<CommandOutcome>
}

const ERROR_TEXT: Record<CommandError | 'connection-lost', string> = {
  [COMMAND_ERROR.GAME_OVER]: 'Партия уже окончена.',
  [COMMAND_ERROR.NOT_YOUR_TURN]: 'Сейчас не ваш ход.',
  [COMMAND_ERROR.PROMPT_PENDING]: 'Сначала нужно ответить на запрос.',
  [COMMAND_ERROR.NO_PROMPT]: 'Запрос уже закрыт.',
  [COMMAND_ERROR.WRONG_PROMPT]: 'Запрос уже закрыт.',
  [COMMAND_ERROR.CARD_NOT_FOUND]: 'Этой карты уже нет там, где вы её искали.',
  [COMMAND_ERROR.CANNOT_AFFORD]: 'Не хватает торговли.',
  [COMMAND_ERROR.ABILITY_UNAVAILABLE]: 'Эта способность сейчас недоступна.',
  [COMMAND_ERROR.ABILITY_USED]: 'Способность уже использована.',
  [COMMAND_ERROR.INVALID_CHOICE]: 'Такой выбор сейчас невозможен.',
  [COMMAND_ERROR.INVALID_AMOUNT]: 'Некорректное значение атаки.',
  [COMMAND_ERROR.OUTPOST_BLOCKS]: 'Сначала нужно уничтожить аванпост.',
  [COMMAND_ERROR.INSUFFICIENT_COMBAT]: 'Не хватает атаки.',
  'connection-lost': 'Связь с сервером потеряна. Команда не отправлена.',
}

const TOAST_LIFETIME_MS = 3500
/** Если после принятой команды update так и не пришёл (потеря связи), ввод всё равно открывается. */
const UPDATE_WAIT_LIMIT_MS = 5000
const LOG_LIMIT = 80

export const useMatchStore = defineStore('match', () => {
  /** То, что нарисовано на столе (renderedView). Отстаёт от сервера на время анимации. */
  const table = shallowRef<TableState | null>(null)
  const legal = shallowRef<Command[]>([])
  const busy = ref(false)
  const waitingForUpdate = ref(false)
  const speed = ref(1)
  const log = ref<LogEntry[]>([])
  const fx = ref<FxItem[]>([])
  const banner = ref<TurnBanner | null>(null)
  const toast = ref<string | null>(null)
  const deadline = ref<number | null>(null)
  const timerTotal = ref(0)
  const selectedCardId = ref<string | null>(null)

  const legalIndex = computed(() => indexLegalActions(legal.value))
  const interactive = computed(() => !busy.value && !waitingForUpdate.value && table.value !== null && table.value.winner === null)

  let transport: MatchTransport | null = null
  let director: AnimationDirector<Motion> | null = null
  let unsubscribe: (() => void) | null = null
  let lastVersion = -1
  let pendingStart: DirectorUpdate | null = null
  let buffered: DirectorUpdate[] = []
  let nextId = 1
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  let waitTimer: ReturnType<typeof setTimeout> | undefined

  function stamp(update: DirectorUpdate): DirectorUpdate {
    return { ...update, receivedAt: update.receivedAt ?? Date.now() }
  }

  function showToast(text: string): void {
    toast.value = text
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast.value = null), TOAST_LIFETIME_MS)
  }

  function pushFx(items: Omit<FxItem, 'id'>[]): void {
    for (const item of items) {
      const entry = { ...item, id: nextId++ }
      fx.value = [...fx.value, entry]
      setTimeout(() => (fx.value = fx.value.filter(existing => existing.id !== entry.id)), FX_LIFETIME_MS)
    }
  }

  function showBanner(mine: boolean): void {
    const entry: TurnBanner = { id: nextId++, mine, text: mine ? 'ВАШ ХОД' : 'ХОД СОПЕРНИКА' }
    banner.value = entry
    setTimeout(() => {
      if (banner.value?.id === entry.id)
        banner.value = null
    }, BANNER_LIFETIME_MS)
  }

  const host = {
    motionFor,
    onStep(group: Parameters<typeof describeStep>[0], before: TableState, after: TableState): void {
      const out = describeStep(group, before, after)
      if (out.entries.length > 0)
        log.value = [...log.value, ...out.entries.map(entry => ({ ...entry, id: nextId++ }))].slice(-LOG_LIMIT)
      pushFx(out.fx)
      const turnStarted = group.find(event => event.type === EVENT_TYPE.TURN_STARTED)
      if (turnStarted && turnStarted.type === EVENT_TYPE.TURN_STARTED)
        showBanner(turnStarted.player === before.you)
    },
    onUpdateDone(update: DirectorUpdate): void {
      legal.value = update.legalActions
      if (update.turnTimeLeftMs === null) {
        deadline.value = null
      }
      else {
        deadline.value = (update.receivedAt ?? Date.now()) + update.turnTimeLeftMs
        timerTotal.value = Math.max(timerTotal.value, update.turnTimeLeftMs)
      }
    },
  }

  function handleUpdate(raw: DirectorUpdate): void {
    const update = stamp(raw)
    if (pendingStart) {
      // Экран ещё не смонтирован: слой карт не сможет показать анимацию, поэтому update дожидается start().
      buffered.push(update)
      return
    }
    apply(update)
  }

  function apply(raw: DirectorUpdate): void {
    // Если мы ждали ответа на свою команду, пришедший update - это он.
    const update = waitingForUpdate.value ? { ...raw, own: true } : raw
    clearTimeout(waitTimer)
    selectedCardId.value = null

    const expected = lastVersion + 1
    lastVersion = update.version
    if (update.version === expected && update.events.length > 0)
      director?.enqueue(update)
    else
      director?.snapTo(update)
    // Ввод открывается только после того, как директор занят update'ом (busy) или состояние уже поставлено:
    // иначе между снятием ожидания и началом анимации есть момент, когда экран выглядит готовым, а стол ещё старый.
    waitingForUpdate.value = false
  }

  /** Подключает матч. Вызывается в setup экрана; анимации начинаются в start(), когда слой карт смонтирован. */
  function attach(next: MatchTransport, stage: DirectorStage<Motion>): void {
    detach()
    transport = next
    director = new AnimationDirector<Motion>({
      stage,
      getTable: () => table.value,
      setTable: (value) => {
        table.value = value
      },
      motionFor: host.motionFor,
      onStep: host.onStep,
      onUpdateDone: host.onUpdateDone,
      onBusyChange: (value) => {
        busy.value = value
      },
      onSpeedChange: (value) => {
        speed.value = value
      },
    })

    const snapshot = next.snapshot()
    if (snapshot) {
      pendingStart = stamp(snapshot)
      lastVersion = snapshot.version
      const initial = buildTable(snapshot.view)
      table.value = isFreshGame(initial) ? introStartTable(initial) : initial
      legal.value = []
    }
    unsubscribe = next.onUpdate(handleUpdate)
  }

  function start(): void {
    if (!pendingStart || !director)
      return
    const first = pendingStart
    pendingStart = null
    director.begin(first)
    const queued = buffered
    buffered = []
    for (const update of queued)
      apply(update)
  }

  function detach(): void {
    unsubscribe?.()
    unsubscribe = null
    clearTimeout(toastTimer)
    clearTimeout(waitTimer)
    director = null
    transport = null
    pendingStart = null
    buffered = []
    lastVersion = -1
    table.value = null
    legal.value = []
    busy.value = false
    waitingForUpdate.value = false
    speed.value = 1
    log.value = []
    fx.value = []
    banner.value = null
    toast.value = null
    deadline.value = null
    timerTotal.value = 0
    selectedCardId.value = null
  }

  /** Возвращает true, если сервер принял команду. */
  async function submit(command: Command): Promise<boolean> {
    if (!transport || !table.value || table.value.winner !== null)
      return false
    // Сдаться можно в любой момент; всё остальное - только когда экран показывает актуальное состояние.
    if (command.type !== COMMAND_TYPE.CONCEDE && !interactive.value)
      return false

    waitingForUpdate.value = true
    clearTimeout(waitTimer)
    waitTimer = setTimeout(() => (waitingForUpdate.value = false), UPDATE_WAIT_LIMIT_MS)

    const result = await transport.submitCommand(command)
    if (!result.ok) {
      waitingForUpdate.value = false
      clearTimeout(waitTimer)
      showToast(ERROR_TEXT[result.reason])
    }
    return result.ok
  }

  /** Сколько карт руки можно сыграть прямо сейчас. */
  const playableCount = computed(() => (interactive.value ? table.value?.self.hand.filter(card => legalIndex.value.playable.has(card.id)).length ?? 0 : 0))
  const playingAll = ref(false)

  /**
   * «Разыграть все»: карты руки одна за другой, сначала те, что не требуют выбора. Каждая следующая отправляется,
   * когда предыдущая доиграла и пришло новое состояние. Цепочка останавливается, как только открылся запрос
   * (утилизация, выбор, сброс соперника): ответив на него, можно нажать кнопку ещё раз.
   */
  async function playAll(): Promise<void> {
    if (playingAll.value || !interactive.value)
      return
    playingAll.value = true
    try {
      // Предел - страховка от бесконечного цикла, если сервер почему-то принимает команды, но рука не убывает.
      for (let step = 0; step < 40; step++) {
        await until(interactive).toBe(true)
        const current = table.value
        if (!current || current.winner !== null || current.prompt !== null)
          break
        const cardId = nextCardToPlay(current.self.hand, legalIndex.value.playable)
        if (cardId === null || !await submit({ type: COMMAND_TYPE.PLAY_CARD, cardId }))
          break
      }
    }
    finally {
      playingAll.value = false
    }
  }

  function select(cardId: string): void {
    selectedCardId.value = selectedCardId.value === cardId ? null : cardId
  }

  return {
    table,
    legal,
    legalIndex,
    busy,
    interactive,
    speed,
    log,
    fx,
    banner,
    toast,
    deadline,
    timerTotal,
    selectedCardId,
    attach,
    start,
    detach,
    submit,
    select,
    playableCount,
    playingAll,
    playAll,
  }
})
