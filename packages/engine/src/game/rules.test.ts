import { describe, expect, it } from 'vitest'
import { EXPLORER_COUNT, TRADE_DECK_COMPOSITION, TRADE_ROW_SIZE } from '../data/config.ts'
import { errorOf, inst, newGame, run, setHand, setInPlay, setRow } from '../testing/testkit.ts'
import { ABILITY_KIND, COMMAND_ERROR, COMMAND_TYPE, EVENT_TYPE, PROMPT_KIND, RESOURCE, SCRAP_ZONE } from '../types/index.ts'
import { apply } from './apply.ts'
import { emptyPools, freshUsage } from './effects.ts'
import { legalActions } from './legal.ts'
import { createGame } from './setup.ts'

function allCards(state: ReturnType<typeof newGame>) {
  return [
    ...state.players.flatMap(p => [...p.deck, ...p.hand, ...p.discard, ...p.inPlay.map(entry => entry.card)]),
    ...state.tradeDeck,
    ...state.tradeRow.filter(card => card !== null),
    ...state.explorers,
    ...state.scrapHeap,
  ]
}

describe('createGame', () => {
  it('раскладывает стартовое состояние по правилам', () => {
    const state = newGame()
    expect(state.players.map(p => p.authority)).toEqual([50, 50])
    expect(state.players[0].hand).toHaveLength(3)
    expect(state.players[0].deck).toHaveLength(7)
    expect(state.players[1].hand).toHaveLength(5)
    expect(state.players[1].deck).toHaveLength(5)
    expect(state.tradeRow).toHaveLength(TRADE_ROW_SIZE)
    expect(state.tradeRow.every(card => card !== null)).toBe(true)
    expect(state.explorers).toHaveLength(EXPLORER_COUNT)
    const tradeDeckSize = Object.values(TRADE_DECK_COMPOSITION).reduce((sum, n) => sum + n, 0)
    expect(state.tradeDeck).toHaveLength(tradeDeckSize - TRADE_ROW_SIZE)
    expect(state.currentPlayer).toBe(0)
    expect(state.winner).toBeNull()
  })

  it('первый игрок выбирается случайно из сида: встречаются оба, один сид - один результат', () => {
    const firsts = Array.from({ length: 40 }, (_, seed) => createGame(seed).currentPlayer)
    expect(new Set(firsts)).toEqual(new Set([0, 1]))
    expect(createGame(5).currentPlayer).toBe(createGame(5).currentPlayer)
  })

  it('первый игрок берёт 3 карты, второй - 5, кто бы ни ходил первым', () => {
    for (const first of [0, 1] as const) {
      const state = createGame(9, { firstPlayer: first })
      const second = first === 0 ? 1 : 0
      expect(state.currentPlayer).toBe(first)
      expect(state.players[first].hand).toHaveLength(3)
      expect(state.players[second].hand).toHaveLength(5)
    }
  })

  it('явный первый игрок не меняет остальную раскладку (бросок всё равно делается)', () => {
    const a = createGame(9, { firstPlayer: 0 })
    const b = createGame(9, { firstPlayer: 1 })
    expect(a.tradeDeck).toEqual(b.tradeDeck)
    expect(a.rngState).toBe(b.rngState)
  })

  it('выдаёт уникальные id всем картам', () => {
    const ids = allCards(newGame()).map(card => card.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('детерминирован: один сид даёт одно состояние, разные сиды - разные', () => {
    expect(createGame(7)).toEqual(createGame(7))
    expect(createGame(7).tradeDeck).not.toEqual(createGame(8).tradeDeck)
  })
})

describe('apply: общие проверки', () => {
  it('не меняет исходное состояние и увеличивает version', () => {
    const state = newGame()
    const [scout] = setHand(state, 0, ['scout'])
    const snapshot = JSON.stringify(state)
    const result = run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: scout.id })
    expect(JSON.stringify(state)).toBe(snapshot)
    expect(result.state.version).toBe(state.version + 1)
  })

  it('отклоняет команду не в свой ход и не от текущего игрока', () => {
    const state = newGame()
    const [scout] = setHand(state, 1, ['scout'])
    expect(errorOf(state, 1, { type: COMMAND_TYPE.PLAY_CARD, cardId: scout.id })).toBe(COMMAND_ERROR.NOT_YOUR_TURN)
    expect(errorOf(state, 0, { type: COMMAND_TYPE.CHOOSE_OPTION, promptId: 1, index: 0 })).toBe(COMMAND_ERROR.NO_PROMPT)
  })

  it('отклонённая команда возвращает только код ошибки', () => {
    const result = apply(newGame(), 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: 'нет-такой' })
    expect(result).toEqual({ ok: false, error: COMMAND_ERROR.CARD_NOT_FOUND })
  })
})

describe('розыгрыш и покупка', () => {
  it('корабль срабатывает при розыгрыше', () => {
    const state = newGame()
    const [scout, viper] = setHand(state, 0, ['scout', 'viper'])
    let result = run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: scout.id })
    expect(result.state.pools[RESOURCE.TRADE]).toBe(1)
    expect(result.state.players[0].hand).toHaveLength(1)
    expect(result.state.players[0].inPlay).toHaveLength(1)
    expect(result.events).toContainEqual({ type: EVENT_TYPE.CARD_PLAYED, player: 0, card: scout })
    expect(result.events).toContainEqual({ type: EVENT_TYPE.RESOURCE_GAINED, player: 0, resource: RESOURCE.TRADE, amount: 1 })

    result = run(result.state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: viper.id })
    expect(result.state.pools[RESOURCE.COMBAT]).toBe(1)
  })

  it('покупка из Торгового ряда: карта в сброс, слот пополняется из колоды', () => {
    const state = newGame()
    const [shuttle] = setRow(state, ['federation-shuttle', 'cutter', 'cutter', 'cutter', 'cutter'])
    state.pools[RESOURCE.TRADE] = 1
    const deckTop = state.tradeDeck[0]!
    const deckSize = state.tradeDeck.length

    const result = run(state, 0, { type: COMMAND_TYPE.BUY, cardId: shuttle.id })
    expect(result.state.pools[RESOURCE.TRADE]).toBe(0)
    expect(result.state.players[0].discard).toContainEqual(shuttle)
    expect(result.state.tradeRow[0]).toEqual(deckTop)
    expect(result.state.tradeDeck).toHaveLength(deckSize - 1)
    expect(result.events.map(event => event.type)).toEqual([
      EVENT_TYPE.RESOURCE_SPENT,
      EVENT_TYPE.CARD_BOUGHT,
      EVENT_TYPE.TRADE_ROW_REFILLED,
    ])
  })

  it('не даёт купить без денег', () => {
    const state = newGame()
    const [cutter] = setRow(state, ['cutter', 'cutter', 'cutter', 'cutter', 'cutter'])
    state.pools[RESOURCE.TRADE] = 1
    expect(errorOf(state, 0, { type: COMMAND_TYPE.BUY, cardId: cutter.id })).toBe(COMMAND_ERROR.CANNOT_AFFORD)
  })

  it('исследователь: покупка уменьшает стопку', () => {
    const state = newGame()
    state.pools[RESOURCE.TRADE] = 2
    const result = run(state, 0, { type: COMMAND_TYPE.BUY_EXPLORER })
    expect(result.state.explorers).toHaveLength(EXPLORER_COUNT - 1)
    expect(result.state.players[0].discard.at(-1)?.cardId).toBe('explorer')
    expect(errorOf(result.state, 0, { type: COMMAND_TYPE.BUY_EXPLORER })).toBe(COMMAND_ERROR.CANNOT_AFFORD)
  })

  it('пустая Торговая колода оставляет слот пустым', () => {
    const state = newGame()
    const [shuttle] = setRow(state, ['federation-shuttle', 'cutter', 'cutter', 'cutter', 'cutter'])
    state.tradeDeck = []
    state.pools[RESOURCE.TRADE] = 1
    const result = run(state, 0, { type: COMMAND_TYPE.BUY, cardId: shuttle.id })
    expect(result.state.tradeRow[0]).toBeNull()
    expect(result.events.some(event => event.type === EVENT_TYPE.TRADE_ROW_REFILLED)).toBe(false)
  })
})

describe('способности', () => {
  it('союзник: простая способность срабатывает сама, когда появляется другая карта той же фракции, и только один раз', () => {
    const state = newGame()
    const [first, second] = setHand(state, 0, ['blob-fighter', 'blob-fighter', 'scout'])
    let result = run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: first.id })
    expect(result.state.pools[RESOURCE.COMBAT]).toBe(3)
    expect(result.state.players[0].hand).toHaveLength(2)
    expect(errorOf(result.state, 0, { type: COMMAND_TYPE.ACTIVATE, cardId: first.id, ability: ABILITY_KIND.ALLY })).toBe(COMMAND_ERROR.ABILITY_UNAVAILABLE)

    // Вторая карта слизней: добор срабатывает и у неё самой, и у первой.
    result = run(result.state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: second.id })
    expect(result.state.players[0].hand).toHaveLength(1 + 2)
    const allyEvents = result.events.filter(event => event.type === EVENT_TYPE.ABILITY_ACTIVATED)
    expect(allyEvents.map(event => event.cardId).sort()).toEqual([first.id, second.id].sort())
    expect(errorOf(result.state, 0, { type: COMMAND_TYPE.ACTIVATE, cardId: first.id, ability: ABILITY_KIND.ALLY })).toBe(COMMAND_ERROR.ABILITY_USED)
    expect(errorOf(result.state, 0, { type: COMMAND_TYPE.ACTIVATE, cardId: second.id, ability: ABILITY_KIND.ALLY })).toBe(COMMAND_ERROR.ABILITY_USED)
    expect(legalActions(result.state, 0).some(action => action.type === COMMAND_TYPE.ACTIVATE)).toBe(false)
  })

  it('нейтральная карта не даёт союзника', () => {
    const state = newGame()
    const [fighter, scout] = setHand(state, 0, ['blob-fighter', 'scout'])
    let result = run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: fighter.id })
    result = run(result.state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: scout.id })
    expect(errorOf(result.state, 0, { type: COMMAND_TYPE.ACTIVATE, cardId: fighter.id, ability: ABILITY_KIND.ALLY })).toBe(COMMAND_ERROR.ABILITY_UNAVAILABLE)
  })

  it('союзником может быть база, оставшаяся с прошлых ходов', () => {
    const state = newGame()
    setInPlay(state, 0, ['blob-wheel'])
    const [fighter] = setHand(state, 0, ['blob-fighter'])
    const result = run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: fighter.id })
    expect(result.state.players[0].hand).toHaveLength(1)
    expect(result.events).toContainEqual({ type: EVENT_TYPE.ABILITY_ACTIVATED, player: 0, cardId: fighter.id, ability: ABILITY_KIND.ALLY })
  })

  it('утилизация: карта уходит в свалку, эффект срабатывает', () => {
    const state = newGame()
    const [post] = setInPlay(state, 0, ['trading-post'])
    const result = run(state, 0, { type: COMMAND_TYPE.ACTIVATE, cardId: post.id, ability: ABILITY_KIND.SCRAP })
    expect(result.state.pools[RESOURCE.COMBAT]).toBe(3)
    expect(result.state.scrapHeap).toContainEqual(post)
    expect(result.state.players[0].inPlay).toHaveLength(0)
  })

  it('выбор: prompt блокирует остальные команды, вариант применяется', () => {
    const state = newGame()
    const [post] = setInPlay(state, 0, ['trading-post'])
    let result = run(state, 0, { type: COMMAND_TYPE.ACTIVATE, cardId: post.id, ability: ABILITY_KIND.BASIC })
    const prompt = result.state.prompt!
    expect(prompt.kind).toBe(PROMPT_KIND.CHOICE)
    expect(errorOf(result.state, 0, { type: COMMAND_TYPE.END_TURN })).toBe(COMMAND_ERROR.PROMPT_PENDING)
    expect(errorOf(result.state, 0, { type: COMMAND_TYPE.CHOOSE_OPTION, promptId: prompt.id, index: 5 })).toBe(COMMAND_ERROR.INVALID_CHOICE)
    expect(errorOf(result.state, 0, { type: COMMAND_TYPE.CHOOSE_OPTION, promptId: prompt.id + 1, index: 0 })).toBe(COMMAND_ERROR.WRONG_PROMPT)

    result = run(result.state, 0, { type: COMMAND_TYPE.CHOOSE_OPTION, promptId: prompt.id, index: 1 })
    expect(result.state.prompt).toBeNull()
    expect(result.state.pools[RESOURCE.TRADE]).toBe(1)
    expect(result.state.players[0].authority).toBe(50)
    expect(errorOf(result.state, 0, { type: COMMAND_TYPE.ACTIVATE, cardId: post.id, ability: ABILITY_KIND.BASIC })).toBe(COMMAND_ERROR.ABILITY_USED)
  })

  it('сброс у соперника откладывается на начало его хода: ход текущего игрока не прерывается', () => {
    const state = newGame()
    const [fighter] = setHand(state, 0, ['imperial-fighter'])
    const [a, b] = setHand(state, 1, ['scout', 'viper'])
    let result = run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: fighter.id })
    expect(result.state.prompt).toBeNull()
    expect(result.state.pools[RESOURCE.COMBAT]).toBe(2)
    expect(result.state.pendingDiscards).toEqual([0, 1])
    expect(result.events).toContainEqual({ type: EVENT_TYPE.DISCARD_QUEUED, player: 1, amount: 1 })

    // В начале своего хода соперник выбирает карту: запрос открывается сразу после TURN_STARTED.
    result = run(result.state, 0, { type: COMMAND_TYPE.END_TURN })
    const types = result.events.map(event => event.type)
    expect(types.indexOf(EVENT_TYPE.PROMPT_OPENED)).toBeGreaterThan(types.indexOf(EVENT_TYPE.TURN_STARTED))
    const prompt = result.state.prompt!
    expect(prompt).toMatchObject({ kind: PROMPT_KIND.DISCARD, player: 1 })
    expect(result.state.pendingDiscards).toEqual([0, 0])
    expect(errorOf(result.state, 1, { type: COMMAND_TYPE.END_TURN })).toBe(COMMAND_ERROR.PROMPT_PENDING)
    expect(errorOf(result.state, 0, { type: COMMAND_TYPE.CHOOSE_CARD, promptId: prompt.id, cardId: a.id })).toBe(COMMAND_ERROR.NOT_YOUR_TURN)
    expect(errorOf(result.state, 1, { type: COMMAND_TYPE.CHOOSE_CARD, promptId: prompt.id, cardId: 'чужая' })).toBe(COMMAND_ERROR.INVALID_CHOICE)

    result = run(result.state, 1, { type: COMMAND_TYPE.CHOOSE_CARD, promptId: prompt.id, cardId: b.id })
    expect(result.state.prompt).toBeNull()
    expect(result.state.players[1].hand).toEqual([a])
    expect(result.state.players[1].discard).toContainEqual(b)
  })

  it('несколько сбросов за ход складываются в один запрос на несколько карт', () => {
    const state = newGame()
    const [first, second] = setHand(state, 0, ['imperial-fighter', 'imperial-fighter'])
    const [a, b, c] = setHand(state, 1, ['scout', 'viper', 'scout'])
    let result = run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: first.id })
    result = run(result.state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: second.id })
    expect(result.state.pendingDiscards).toEqual([0, 2])

    result = run(result.state, 0, { type: COMMAND_TYPE.END_TURN })
    expect(result.state.prompt).toMatchObject({ kind: PROMPT_KIND.DISCARD, player: 1, remaining: 2 })
    result = run(result.state, 1, { type: COMMAND_TYPE.CHOOSE_CARD, promptId: result.state.prompt!.id, cardId: a.id })
    expect(result.state.prompt).toMatchObject({ kind: PROMPT_KIND.DISCARD, player: 1, remaining: 1 })
    result = run(result.state, 1, { type: COMMAND_TYPE.CHOOSE_CARD, promptId: result.state.prompt!.id, cardId: b.id })
    expect(result.state.prompt).toBeNull()
    expect(result.state.players[1].hand).toEqual([c])
  })

  it('несколько сбросов можно закрыть одним ответом CHOOSE_CARDS', () => {
    const state = newGame()
    const [first, second] = setHand(state, 0, ['imperial-fighter', 'imperial-fighter'])
    const [a, b, c] = setHand(state, 1, ['scout', 'viper', 'scout'])
    let result = run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: first.id })
    result = run(result.state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: second.id })
    result = run(result.state, 0, { type: COMMAND_TYPE.END_TURN })
    const promptId = result.state.prompt!.id

    // Нужно ровно столько карт, сколько велено, без повторов и чужих карт.
    expect(errorOf(result.state, 1, { type: COMMAND_TYPE.CHOOSE_CARDS, promptId, cardIds: [a.id] })).toBe(COMMAND_ERROR.INVALID_CHOICE)
    expect(errorOf(result.state, 1, { type: COMMAND_TYPE.CHOOSE_CARDS, promptId, cardIds: [a.id, a.id] })).toBe(COMMAND_ERROR.INVALID_CHOICE)
    expect(errorOf(result.state, 1, { type: COMMAND_TYPE.CHOOSE_CARDS, promptId, cardIds: [a.id, 'чужая'] })).toBe(COMMAND_ERROR.INVALID_CHOICE)
    expect(errorOf(result.state, 0, { type: COMMAND_TYPE.CHOOSE_CARDS, promptId, cardIds: [a.id, b.id] })).toBe(COMMAND_ERROR.NOT_YOUR_TURN)

    result = run(result.state, 1, { type: COMMAND_TYPE.CHOOSE_CARDS, promptId, cardIds: [a.id, c.id] })
    expect(result.state.prompt).toBeNull()
    expect(result.state.players[1].hand).toEqual([b])
    expect(result.events.filter(event => event.type === EVENT_TYPE.CARD_DISCARDED)).toHaveLength(2)
  })

  it('необязательный сброс с добором: CHOOSE_CARDS берёт карту за каждую сброшенную', () => {
    const state = newGame()
    const [station] = setInPlay(state, 0, ['recycling-station'])
    const hand = setHand(state, 0, ['scout', 'viper', 'scout'])
    state.players[0].deck = [inst('cutter'), inst('cutter'), inst('cutter')]
    let result = run(state, 0, { type: COMMAND_TYPE.ACTIVATE, cardId: station.id, ability: ABILITY_KIND.BASIC })
    result = run(result.state, 0, { type: COMMAND_TYPE.CHOOSE_OPTION, promptId: result.state.prompt!.id, index: 1 })
    const promptId = result.state.prompt!.id
    expect(errorOf(result.state, 0, { type: COMMAND_TYPE.CHOOSE_CARDS, promptId, cardIds: [hand[0].id, hand[1].id, hand[2].id] })).toBe(COMMAND_ERROR.INVALID_CHOICE)

    result = run(result.state, 0, { type: COMMAND_TYPE.CHOOSE_CARDS, promptId, cardIds: [hand[0].id, hand[1].id] })
    expect(result.state.prompt).toBeNull()
    expect(result.state.players[0].discard).toHaveLength(2)
    expect(result.state.players[0].hand).toHaveLength(3)
  })

  it('cHOOSE_CARDS не подходит к запросам, кроме сброса', () => {
    const state = newGame()
    const [bot] = setHand(state, 0, ['trade-bot'])
    state.players[0].discard = [inst('scout')]
    const played = run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: bot.id })
    expect(errorOf(played.state, 0, { type: COMMAND_TYPE.CHOOSE_CARDS, promptId: played.state.prompt!.id, cardIds: ['x'] })).toBe(COMMAND_ERROR.INVALID_CHOICE)
  })

  it('сброс у соперника без карт в руке сгорает', () => {
    const state = newGame()
    const [fighter] = setHand(state, 0, ['imperial-fighter'])
    setHand(state, 1, [])
    state.players[1].deck = []
    state.players[1].discard = []
    let result = run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: fighter.id })
    expect(result.state.prompt).toBeNull()
    expect(result.state.pools[RESOURCE.COMBAT]).toBe(2)
    result = run(result.state, 0, { type: COMMAND_TYPE.END_TURN })
    expect(result.state.prompt).toBeNull()
    expect(result.state.pendingDiscards).toEqual([0, 0])
  })

  it('база с прошлых ходов запускает простую способность союзника в начале хода', () => {
    const state = newGame()
    // Две базы одной фракции на столе игрока 1: их способности союзника срабатывают на старте его хода.
    const [first] = setInPlay(state, 1, ['space-station', 'space-station'])
    const result = run(state, 0, { type: COMMAND_TYPE.END_TURN })
    const types = result.events.map(event => event.type)
    expect(types.indexOf(EVENT_TYPE.ABILITY_ACTIVATED)).toBeGreaterThan(types.indexOf(EVENT_TYPE.TURN_STARTED))
    // По 2 атаки от основной способности и от способности союзника каждой из двух баз.
    expect(result.state.pools[RESOURCE.COMBAT]).toBe(8)
    expect(result.state.players[1].inPlay.find(entry => entry.card.id === first.id)?.used[ABILITY_KIND.ALLY]).toBe(true)
  })

  it('основная способность базы без выбора срабатывает сама при выкладывании и недоступна вручную', () => {
    const state = newGame()
    const [wheel] = setHand(state, 0, ['blob-wheel'])
    const result = run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: wheel.id })
    expect(result.events).toContainEqual({ type: EVENT_TYPE.ABILITY_ACTIVATED, player: 0, cardId: wheel.id, ability: ABILITY_KIND.BASIC })
    expect(result.state.pools[RESOURCE.COMBAT]).toBe(1)
    expect(errorOf(result.state, 0, { type: COMMAND_TYPE.ACTIVATE, cardId: wheel.id, ability: ABILITY_KIND.BASIC })).toBe(COMMAND_ERROR.ABILITY_USED)
    expect(legalActions(result.state, 0).some(action => action.type === COMMAND_TYPE.ACTIVATE && action.ability === ABILITY_KIND.BASIC)).toBe(false)
  })

  it('основная способность базы с выбором или сбросом остаётся ручной', () => {
    const state = newGame()
    const [brain, trading] = setHand(state, 0, ['brain-world', 'trading-post'])
    let result = run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: brain.id })
    result = run(result.state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: trading.id })
    expect(result.state.prompt).toBeNull()
    expect(result.events.some(event => event.type === EVENT_TYPE.ABILITY_ACTIVATED && event.ability === ABILITY_KIND.BASIC)).toBe(false)
    expect(legalActions(result.state, 0)).toContainEqual({ type: COMMAND_TYPE.ACTIVATE, cardId: brain.id, ability: ABILITY_KIND.BASIC })
    expect(legalActions(result.state, 0)).toContainEqual({ type: COMMAND_TYPE.ACTIVATE, cardId: trading.id, ability: ABILITY_KIND.BASIC })
  })

  it('основная способность базы с прошлых ходов срабатывает в начале хода', () => {
    const state = newGame()
    setInPlay(state, 1, ['blob-wheel'])
    const result = run(state, 0, { type: COMMAND_TYPE.END_TURN })
    expect(result.state.pools[RESOURCE.COMBAT]).toBe(1)
  })

  it('необязательная утилизация из руки/сброса: можно выбрать карту или пропустить', () => {
    const state = newGame()
    const [bot] = setHand(state, 0, ['trade-bot'])
    const junk = inst('scout')
    state.players[0].discard = [junk]

    const played = run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: bot.id })
    const prompt = played.state.prompt!
    expect(prompt).toMatchObject({ kind: PROMPT_KIND.SCRAP, optional: true })
    expect(played.state.pools[RESOURCE.TRADE]).toBe(1)

    const scrapped = run(played.state, 0, { type: COMMAND_TYPE.CHOOSE_CARD, promptId: prompt.id, cardId: junk.id })
    expect(scrapped.state.scrapHeap).toContainEqual(junk)
    expect(scrapped.state.players[0].discard).toHaveLength(0)

    const skipped = run(played.state, 0, { type: COMMAND_TYPE.SKIP, promptId: prompt.id })
    expect(skipped.state.prompt).toBeNull()
    expect(skipped.state.scrapHeap).toHaveLength(0)
  })

  it('утилизированный Исследователь возвращается в стопку, а не в утиль', () => {
    const state = newGame()
    const [bot] = setHand(state, 0, ['trade-bot'])
    const explorer = inst('explorer')
    state.players[0].discard = [explorer]

    const played = run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: bot.id })
    const scrapped = run(played.state, 0, { type: COMMAND_TYPE.CHOOSE_CARD, promptId: played.state.prompt!.id, cardId: explorer.id })
    expect(scrapped.state.scrapHeap).toHaveLength(0)
    expect(scrapped.state.explorers).toHaveLength(EXPLORER_COUNT + 1)
    expect(scrapped.state.explorers.at(-1)).toEqual(explorer)
    expect(scrapped.events.map(event => event.type)).toContain(EVENT_TYPE.CARD_SCRAPPED)
  })

  it('утилизация без кандидатов не открывает prompt', () => {
    const state = newGame()
    const [bot] = setHand(state, 0, ['trade-bot'])
    state.players[0].discard = []
    const result = run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: bot.id })
    expect(result.state.prompt).toBeNull()
  })

  it('утилизация из Торгового ряда пополняет слот', () => {
    const state = newGame()
    const [pod] = setHand(state, 0, ['battle-pod'])
    const [target] = setRow(state, ['royal-redoubt', 'cutter', 'cutter', 'cutter', 'cutter'])
    const played = run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: pod.id })
    const prompt = played.state.prompt!
    expect(prompt).toMatchObject({ kind: PROMPT_KIND.SCRAP, zones: [SCRAP_ZONE.TRADE_ROW], optional: true })

    const result = run(played.state, 0, { type: COMMAND_TYPE.CHOOSE_CARD, promptId: prompt.id, cardId: target.id })
    expect(result.state.scrapHeap).toContainEqual(target)
    expect(result.state.tradeRow[0]).toEqual(state.tradeDeck[0])
    expect(result.events.map(event => event.type)).toEqual([
      EVENT_TYPE.CARD_SCRAPPED,
      EVENT_TYPE.TRADE_ROW_REFILLED,
      EVENT_TYPE.PROMPT_RESOLVED,
    ])
  })

  it('обязательная утилизация после добора: SKIP запрещён', () => {
    const state = newGame()
    const [base] = setInPlay(state, 0, ['machine-base'])
    const [victim] = setHand(state, 0, ['scout'])
    const activated = run(state, 0, { type: COMMAND_TYPE.ACTIVATE, cardId: base.id, ability: ABILITY_KIND.BASIC })
    const prompt = activated.state.prompt!
    expect(prompt).toMatchObject({ kind: PROMPT_KIND.SCRAP, zones: [SCRAP_ZONE.HAND], optional: false })
    // карта взята до prompt, значит в руке уже есть и она, и новая
    expect(activated.state.players[0].hand).toHaveLength(2)
    expect(errorOf(activated.state, 0, { type: COMMAND_TYPE.SKIP, promptId: prompt.id })).toBe(COMMAND_ERROR.INVALID_CHOICE)

    const result = run(activated.state, 0, { type: COMMAND_TYPE.CHOOSE_CARD, promptId: prompt.id, cardId: victim.id })
    expect(result.state.scrapHeap).toContainEqual(victim)
    expect(result.state.players[0].hand).toHaveLength(1)
  })
})

describe('атака', () => {
  it('аванпост блокирует атаку на игрока и на обычные базы', () => {
    const state = newGame()
    const [, wheel] = setInPlay(state, 1, ['battle-station', 'blob-wheel'])
    state.pools[RESOURCE.COMBAT] = 10
    expect(errorOf(state, 0, { type: COMMAND_TYPE.ATTACK_PLAYER, amount: 1 })).toBe(COMMAND_ERROR.OUTPOST_BLOCKS)
    expect(errorOf(state, 0, { type: COMMAND_TYPE.ATTACK_BASE, cardId: wheel.id })).toBe(COMMAND_ERROR.OUTPOST_BLOCKS)
  })

  it('уничтожение аванпоста тратит боевую мощь ровно на защиту, карта уходит в сброс владельца', () => {
    const state = newGame()
    const [station] = setInPlay(state, 1, ['battle-station'])
    state.pools[RESOURCE.COMBAT] = 4
    expect(errorOf(state, 0, { type: COMMAND_TYPE.ATTACK_BASE, cardId: station.id })).toBe(COMMAND_ERROR.INSUFFICIENT_COMBAT)

    state.pools[RESOURCE.COMBAT] = 7
    const result = run(state, 0, { type: COMMAND_TYPE.ATTACK_BASE, cardId: station.id })
    expect(result.state.pools[RESOURCE.COMBAT]).toBe(2)
    expect(result.state.players[1].inPlay).toHaveLength(0)
    expect(result.state.players[1].discard).toContainEqual(station)
    expect(result.events).toContainEqual({ type: EVENT_TYPE.BASE_DESTROYED, owner: 1, card: station })
  })

  it('после уничтожения аванпоста можно бить по игроку любой суммой не больше пула', () => {
    const state = newGame()
    state.pools[RESOURCE.COMBAT] = 5
    expect(errorOf(state, 0, { type: COMMAND_TYPE.ATTACK_PLAYER, amount: 0 })).toBe(COMMAND_ERROR.INVALID_AMOUNT)
    expect(errorOf(state, 0, { type: COMMAND_TYPE.ATTACK_PLAYER, amount: 6 })).toBe(COMMAND_ERROR.INVALID_AMOUNT)
    expect(errorOf(state, 0, { type: COMMAND_TYPE.ATTACK_PLAYER, amount: 1.5 })).toBe(COMMAND_ERROR.INVALID_AMOUNT)

    const result = run(state, 0, { type: COMMAND_TYPE.ATTACK_PLAYER, amount: 3 })
    expect(result.state.players[1].authority).toBe(47)
    expect(result.state.pools[RESOURCE.COMBAT]).toBe(2)
    expect(result.events).toContainEqual({ type: EVENT_TYPE.PLAYER_ATTACKED, attacker: 0, target: 1, amount: 3 })
  })

  it('победа: авторитет соперника 0 или ниже, дальше команды не принимаются', () => {
    const state = newGame()
    state.players[1].authority = 3
    state.pools[RESOURCE.COMBAT] = 3
    const result = run(state, 0, { type: COMMAND_TYPE.ATTACK_PLAYER, amount: 3 })
    expect(result.state.winner).toBe(0)
    expect(result.events).toContainEqual({ type: EVENT_TYPE.GAME_OVER, winner: 0 })
    expect(errorOf(result.state, 0, { type: COMMAND_TYPE.END_TURN })).toBe(COMMAND_ERROR.GAME_OVER)
    expect(errorOf(result.state, 1, { type: COMMAND_TYPE.END_TURN })).toBe(COMMAND_ERROR.GAME_OVER)
  })
})

describe('конец хода', () => {
  it('сбрасывает руку и корабли, оставляет базы, берёт 5 карт и передаёт ход', () => {
    const state = newGame()
    const [base] = setInPlay(state, 0, ['blob-wheel'])
    const [scout, viper] = setHand(state, 0, ['scout', 'viper'])
    // База уже на столе и ещё не использована: розыгрыш любой карты запускает её простую способность.
    let result = run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: scout.id })
    expect(result.state.pools[RESOURCE.COMBAT]).toBe(1)

    result = run(result.state, 0, { type: COMMAND_TYPE.END_TURN })
    const me = result.state.players[0]
    expect(me.hand).toHaveLength(5)
    expect(me.discard).toEqual(expect.arrayContaining([scout, viper]))
    expect(me.inPlay.map(entry => entry.card)).toEqual([base])
    expect(result.state.currentPlayer).toBe(1)
    expect(result.state.turn).toBe(2)
    expect(result.state.pools).toEqual(emptyPools())
    expect(result.events.at(-1)).toEqual({ type: EVENT_TYPE.TURN_STARTED, player: 1, turn: 2 })

    // способности базы обновляются в начале следующего хода её владельца, простая основная срабатывает снова
    result = run(result.state, 1, { type: COMMAND_TYPE.END_TURN })
    expect(result.state.players[0].inPlay[0]!.used).toEqual({ ...freshUsage(), [ABILITY_KIND.BASIC]: true })
    expect(result.state.pools[RESOURCE.COMBAT]).toBe(1)
    expect(result.state.turn).toBe(3)
  })

  it('перемешивает сброс, если колода кончилась посреди добора', () => {
    const state = newGame()
    setHand(state, 0, [])
    state.players[0].deck = [inst('scout'), inst('scout')]
    state.players[0].discard = Array.from({ length: 6 }, () => inst('viper'))

    const result = run(state, 0, { type: COMMAND_TYPE.END_TURN })
    expect(result.events.map(event => event.type)).toContain(EVENT_TYPE.DECK_SHUFFLED)
    const draws = result.events.filter(event => event.type === EVENT_TYPE.CARDS_DRAWN)
    expect(draws.map(event => event.count)).toEqual([2, 3])
    expect(result.state.players[0].hand).toHaveLength(5)
    expect(result.state.players[0].deck).toHaveLength(3)
  })
})

describe('сдача (CONCEDE)', () => {
  it('соперник побеждает, сдаться можно в чужой ход', () => {
    const state = newGame()
    const result = run(state, 1, { type: COMMAND_TYPE.CONCEDE })
    expect(result.state.winner).toBe(0)
    expect(result.events).toContainEqual({ type: EVENT_TYPE.GAME_OVER, winner: 0 })
  })

  it('работает, даже если открыт prompt другого игрока', () => {
    const state = newGame()
    const [fighter] = setHand(state, 0, ['imperial-fighter'])
    setHand(state, 1, ['scout'])
    const played = run(run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId: fighter.id }).state, 0, { type: COMMAND_TYPE.END_TURN })
    expect(played.state.prompt).toMatchObject({ kind: PROMPT_KIND.DISCARD, player: 1 })

    const result = run(played.state, 0, { type: COMMAND_TYPE.CONCEDE })
    expect(result.state.winner).toBe(1)
    expect(result.state.prompt).not.toBeNull()
  })

  it('после конца партии недоступен', () => {
    const state = newGame()
    const over = run(state, 0, { type: COMMAND_TYPE.CONCEDE }).state
    expect(errorOf(over, 0, { type: COMMAND_TYPE.CONCEDE })).toBe(COMMAND_ERROR.GAME_OVER)
  })

  it('не предлагается как обычное игровое действие', () => {
    const actions = legalActions(newGame(), 0)
    expect(actions.some(action => action.type === COMMAND_TYPE.CONCEDE)).toBe(false)
  })
})
