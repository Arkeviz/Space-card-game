import type { GameState } from '../types/index.ts'
import { describe, expect, it } from 'vitest'
import { inst, newGame, run, setHand, setInPlay, setRow } from '../testing/testkit.ts'
import { ABILITY_KIND, COMMAND_ERROR, COMMAND_TYPE, DESTINATION, EVENT_TYPE, PROMPT_KIND, RESOURCE } from '../types/index.ts'
import { apply } from './apply.ts'
import { legalActions } from './legal.ts'

const play = (state: GameState, cardId: string) => run(state, 0, { type: COMMAND_TYPE.PLAY_CARD, cardId })
function activate(state: GameState, cardId: string, ability: typeof ABILITY_KIND[keyof typeof ABILITY_KIND]) {
  return run(state, 0, { type: COMMAND_TYPE.ACTIVATE, cardId, ability })
}
function pick(state: GameState, cardId: string, player: 0 | 1 = 0) {
  return run(state, player, { type: COMMAND_TYPE.CHOOSE_CARD, promptId: state.prompt!.id, cardId })
}
const skip = (state: GameState) => run(state, 0, { type: COMMAND_TYPE.SKIP, promptId: state.prompt!.id })

describe('торговая федерация', () => {
  it('federation Shuttle: союзник сам даёт 4 авторитета, как только в игре появляется другая карта федерации', () => {
    const state = newGame()
    const [shuttle, post] = setHand(state, 0, ['federation-shuttle', 'trading-post'])
    let result = play(state, shuttle.id)
    expect(result.state.players[0].authority).toBe(50)
    result = play(result.state, post.id)
    expect(result.state.players[0].authority).toBe(54)
    expect(result.events).toContainEqual({ type: EVENT_TYPE.ABILITY_ACTIVATED, player: 0, cardId: shuttle.id, ability: ABILITY_KIND.ALLY })
  })

  it('embassy Yacht: две карты берутся только при двух и более базах', () => {
    const withBases = newGame()
    setInPlay(withBases, 0, ['barter-world', 'trading-post'])
    const [yacht] = setHand(withBases, 0, ['embassy-yacht'])
    const handBefore = withBases.players[0].hand.length
    const drawn = play(withBases, yacht.id)
    expect(drawn.state.players[0].hand).toHaveLength(handBefore - 1 + 2)

    const without = newGame()
    setInPlay(without, 0, ['barter-world'])
    const [yacht2] = setHand(without, 0, ['embassy-yacht'])
    const result = play(without, yacht2.id)
    expect(result.state.players[0].hand).toHaveLength(0)
  })

  it('freighter: следующий купленный корабль ложится на верх колоды, второй - в сброс', () => {
    const state = newGame()
    const [freighter, post] = setHand(state, 0, ['freighter', 'trading-post'])
    const [first, second] = setRow(state, ['federation-shuttle', 'federation-shuttle', 'cutter', 'cutter', 'cutter'])
    state.pools[RESOURCE.TRADE] = 5

    let result = play(state, freighter.id)
    expect(result.state.nextShipToDeckTop).toBe(false)
    // Союзник срабатывает сам, когда в игре появляется другая карта федерации.
    result = play(result.state, post.id)
    expect(result.state.nextShipToDeckTop).toBe(true)

    result = run(result.state, 0, { type: COMMAND_TYPE.BUY, cardId: first.id })
    expect(result.state.players[0].deck[0]).toEqual(first)
    expect(result.state.players[0].discard).not.toContainEqual(first)
    expect(result.state.nextShipToDeckTop).toBe(false)
    expect(result.events).toContainEqual(expect.objectContaining({ type: EVENT_TYPE.CARD_BOUGHT, to: DESTINATION.DECK_TOP }))

    result = run(result.state, 0, { type: COMMAND_TYPE.BUY, cardId: second.id })
    expect(result.state.players[0].discard).toContainEqual(second)
  })

  it('флаг «на верх колоды» не тратится на базу и сбрасывается в конце хода', () => {
    const state = newGame()
    const [office] = setInPlay(state, 0, ['central-office'])
    const [base] = setRow(state, ['trading-post', 'cutter', 'cutter', 'cutter', 'cutter'])
    state.pools[RESOURCE.TRADE] = 5
    let result = activate(state, office.id, ABILITY_KIND.BASIC)
    result = run(result.state, 0, { type: COMMAND_TYPE.BUY, cardId: base.id })
    expect(result.state.nextShipToDeckTop).toBe(true)
    expect(result.state.players[0].discard).toContainEqual(base)

    result = run(result.state, 0, { type: COMMAND_TYPE.END_TURN })
    expect(result.state.nextShipToDeckTop).toBe(false)
    expect(result.state.playedThisTurn).toEqual([])
  })

  it('port of Call: утилизация берёт карту и позволяет уничтожить любую базу, включая аванпост', () => {
    const state = newGame()
    const [port] = setInPlay(state, 0, ['port-of-call'])
    const [outpost, base] = setInPlay(state, 1, ['trading-post', 'barter-world'])
    state.players[0].deck = [inst('scout')]

    let result = activate(state, port.id, ABILITY_KIND.SCRAP)
    expect(result.state.prompt).toMatchObject({ kind: PROMPT_KIND.DESTROY_BASE, optional: true })
    expect(legalActions(result.state, 0)).toContainEqual({ type: COMMAND_TYPE.SKIP, promptId: result.state.prompt!.id })

    result = pick(result.state, base.id)
    expect(result.state.players[1].inPlay.map(entry => entry.card.id)).toEqual([outpost.id])
    expect(result.state.players[1].discard).toContainEqual(base)
    expect(result.state.prompt).toBeNull()
  })
})

describe('слизни', () => {
  it('союзник с выбором остаётся ручным: не срабатывает сам, а доступен командой', () => {
    const state = newGame()
    const [destroyer, fighter] = setHand(state, 0, ['blob-destroyer', 'blob-fighter'])
    setInPlay(state, 1, ['barter-world'])
    let result = play(state, destroyer.id)
    result = play(result.state, fighter.id)
    expect(result.state.prompt).toBeNull()
    expect(result.events.some(event => event.type === EVENT_TYPE.ABILITY_ACTIVATED && event.cardId === destroyer.id)).toBe(false)
    expect(legalActions(result.state, 0)).toContainEqual({ type: COMMAND_TYPE.ACTIVATE, cardId: destroyer.id, ability: ABILITY_KIND.ALLY })
  })

  it('blob Carrier: союзник отдаёт любой корабль из ряда на верх колоды и пополняет ряд', () => {
    const state = newGame()
    const [carrier] = setInPlay(state, 0, ['blob-carrier', 'blob-fighter'])
    const [base, ship] = setRow(state, ['barter-world', 'cutter', 'cutter', 'cutter', 'cutter'])

    let result = activate(state, carrier.id, ABILITY_KIND.ALLY)
    expect(result.state.prompt?.kind).toBe(PROMPT_KIND.ACQUIRE_SHIP)
    // Базы получить нельзя, только корабли.
    expect(apply(result.state, 0, { type: COMMAND_TYPE.CHOOSE_CARD, promptId: result.state.prompt!.id, cardId: base.id })).toMatchObject({ ok: false, error: COMMAND_ERROR.INVALID_CHOICE })

    result = pick(result.state, ship.id)
    expect(result.state.players[0].deck[0]).toEqual(ship)
    expect(result.state.tradeRow.every(card => card !== null)).toBe(true)
    expect(result.events.map(event => event.type)).toContain(EVENT_TYPE.CARD_ACQUIRED)
    expect(result.events.map(event => event.type)).toContain(EVENT_TYPE.TRADE_ROW_REFILLED)
  })

  it('blob Carrier: можно получить и Исследователя', () => {
    const state = newGame()
    const [carrier] = setInPlay(state, 0, ['blob-carrier', 'blob-fighter'])
    setRow(state, ['barter-world', 'barter-world', 'barter-world', 'barter-world', 'barter-world'])
    const explorer = state.explorers[0]!
    const result = pick(activate(state, carrier.id, ABILITY_KIND.ALLY).state, explorer.id)
    expect(result.state.players[0].deck[0]).toEqual(explorer)
    expect(result.state.explorers).not.toContainEqual(explorer)
  })

  it('blob Destroyer: сначала можно уничтожить базу, затем утилизировать карту ряда - оба шага необязательны', () => {
    const state = newGame()
    const [destroyer] = setInPlay(state, 0, ['blob-destroyer', 'blob-fighter'])
    const [target] = setInPlay(state, 1, ['barter-world'])
    const [row] = setRow(state, ['cutter', 'cutter', 'cutter', 'cutter', 'cutter'])

    let result = activate(state, destroyer.id, ABILITY_KIND.ALLY)
    expect(result.state.prompt?.kind).toBe(PROMPT_KIND.DESTROY_BASE)
    result = pick(result.state, target.id)
    expect(result.state.prompt).toMatchObject({ kind: PROMPT_KIND.SCRAP, optional: true })
    result = pick(result.state, row.id)
    expect(result.state.scrapHeap).toContainEqual(row)
    expect(result.state.prompt).toBeNull()

    // Оба шага можно пропустить.
    let skipped = activate(state, destroyer.id, ABILITY_KIND.ALLY)
    skipped = skip(skipped.state)
    skipped = skip(skipped.state)
    expect(skipped.state.prompt).toBeNull()
    expect(skipped.state.players[1].inPlay).toHaveLength(1)
  })

  it('blob World: вариант «карты за слизней» берёт по карте за каждую сыгранную в этот ход карту слизней', () => {
    const state = newGame()
    const [world] = setInPlay(state, 0, ['blob-world'])
    state.playedThisTurn = ['blob-fighter', 'ram', 'cutter', 'scout']
    state.players[0].hand = []
    state.players[0].deck = [inst('scout'), inst('scout'), inst('scout'), inst('scout')]

    let result = activate(state, world.id, ABILITY_KIND.BASIC)
    expect(result.state.prompt?.kind).toBe(PROMPT_KIND.CHOICE)
    result = run(result.state, 0, { type: COMMAND_TYPE.CHOOSE_OPTION, promptId: result.state.prompt!.id, index: 1 })
    expect(result.state.players[0].hand).toHaveLength(2)
  })

  it('blob World: вариант «5 атаки»', () => {
    const state = newGame()
    const [world] = setInPlay(state, 0, ['blob-world'])
    let result = activate(state, world.id, ABILITY_KIND.BASIC)
    result = run(result.state, 0, { type: COMMAND_TYPE.CHOOSE_OPTION, promptId: result.state.prompt!.id, index: 0 })
    expect(result.state.pools[RESOURCE.COMBAT]).toBe(5)
  })
})

describe('технокульт', () => {
  it('missile Mech: уничтожение базы обязательно, пропустить нельзя', () => {
    const state = newGame()
    const [mech] = setHand(state, 0, ['missile-mech'])
    const [target] = setInPlay(state, 1, ['barter-world'])
    const result = play(state, mech.id)
    expect(result.state.prompt).toMatchObject({ kind: PROMPT_KIND.DESTROY_BASE, optional: false })
    expect(apply(result.state, 0, { type: COMMAND_TYPE.SKIP, promptId: result.state.prompt!.id })).toMatchObject({ ok: false, error: COMMAND_ERROR.INVALID_CHOICE })
    expect(pick(result.state, target.id).state.players[1].inPlay).toHaveLength(0)
  })

  it('missile Mech: без баз у соперника запроса нет, атака начисляется', () => {
    const state = newGame()
    const [mech] = setHand(state, 0, ['missile-mech'])
    const result = play(state, mech.id)
    expect(result.state.prompt).toBeNull()
    expect(result.state.pools[RESOURCE.COMBAT]).toBe(6)
  })

  it('stealth Needle: копирует корабль, повторяет его эффект и получает его фракцию для союзников', () => {
    const state = newGame()
    const [fighter, needle] = setHand(state, 0, ['blob-fighter', 'stealth-needle'])
    state.players[0].deck = [inst('scout'), inst('scout')]

    let result = play(state, fighter.id)
    result = play(result.state, needle.id)
    expect(result.state.prompt).toMatchObject({ kind: PROMPT_KIND.COPY_SHIP })
    // Сама карта в кандидаты не входит.
    expect(legalActions(result.state, 0)).toEqual([{ type: COMMAND_TYPE.CHOOSE_CARD, promptId: result.state.prompt!.id, cardId: fighter.id }])

    result = pick(result.state, fighter.id)
    expect(result.state.pools[RESOURCE.COMBAT]).toBe(6)
    const entry = result.state.players[0].inPlay.find(item => item.card.id === needle.id)!
    expect(entry.copyOf).toBe('blob-fighter')
    expect(result.events).toContainEqual({ type: EVENT_TYPE.SHIP_COPIED, player: 0, cardId: needle.id, copyOf: 'blob-fighter' })

    // Теперь игла - слизни: простые способности союзника (добор) сработали сами и у иглы, и у слизня.
    expect(result.state.players[0].hand).toHaveLength(2)
    const allyEvents = result.events.filter(event => event.type === EVENT_TYPE.ABILITY_ACTIVATED)
    expect(allyEvents.map(event => event.cardId).sort()).toEqual([fighter.id, needle.id].sort())
  })

  it('stealth Needle без других кораблей просто ложится на стол', () => {
    const state = newGame()
    const [needle] = setHand(state, 0, ['stealth-needle'])
    const result = play(state, needle.id)
    expect(result.state.prompt).toBeNull()
  })

  it('mech World: считается союзником для любой фракции', () => {
    const state = newGame()
    setInPlay(state, 0, ['mech-world'])
    const [cutter] = setHand(state, 0, ['cutter'])
    const result = play(state, cutter.id)
    expect(result.state.pools[RESOURCE.COMBAT]).toBe(4)
  })

  it('brain World: можно утилизировать до двух карт, за каждую берётся карта; пропуск заканчивает цепочку', () => {
    const state = newGame()
    const [brain] = setInPlay(state, 0, ['brain-world'])
    const hand = setHand(state, 0, ['scout', 'viper', 'scout'])
    state.players[0].deck = [inst('cutter'), inst('cutter'), inst('cutter')]

    let result = activate(state, brain.id, ABILITY_KIND.BASIC)
    expect(result.state.prompt).toMatchObject({ kind: PROMPT_KIND.SCRAP, remaining: 2, drawPerScrap: true })
    result = pick(result.state, hand[0].id)
    expect(result.state.prompt).toMatchObject({ kind: PROMPT_KIND.SCRAP, remaining: 1 })
    expect(result.state.players[0].hand).toHaveLength(3)
    result = pick(result.state, hand[1].id)
    expect(result.state.prompt).toBeNull()
    expect(result.state.scrapHeap).toHaveLength(2)
    expect(result.state.players[0].hand).toHaveLength(3)

    const once = skip(activate(state, brain.id, ABILITY_KIND.BASIC).state)
    expect(once.state.prompt).toBeNull()
    expect(once.state.scrapHeap).toHaveLength(0)
  })
})

describe('звёздная империя', () => {
  it('fleet HQ: каждый сыгранный после него корабль даёт +1 атаки', () => {
    const state = newGame()
    setInPlay(state, 0, ['fleet-hq'])
    const [viper] = setHand(state, 0, ['viper'])
    const result = play(state, viper.id)
    expect(result.state.pools[RESOURCE.COMBAT]).toBe(2)
  })

  it('recycling Station: вариант «сбросьте до двух карт и возьмите столько же»', () => {
    const state = newGame()
    const [station] = setInPlay(state, 0, ['recycling-station'])
    const hand = setHand(state, 0, ['scout', 'viper', 'scout'])
    state.players[0].deck = [inst('cutter'), inst('cutter'), inst('cutter')]

    let result = activate(state, station.id, ABILITY_KIND.BASIC)
    result = run(result.state, 0, { type: COMMAND_TYPE.CHOOSE_OPTION, promptId: result.state.prompt!.id, index: 1 })
    expect(result.state.prompt).toMatchObject({ kind: PROMPT_KIND.DISCARD, optional: true, remaining: 2, drawPerDiscard: true })
    result = pick(result.state, hand[0].id)
    expect(result.state.prompt).toMatchObject({ remaining: 1 })
    result = skip(result.state)
    expect(result.state.prompt).toBeNull()
    expect(result.state.players[0].discard).toHaveLength(1)
    expect(result.state.players[0].hand).toHaveLength(3)
  })

  it('recycling Station: вариант «1 торговля»', () => {
    const state = newGame()
    const [station] = setInPlay(state, 0, ['recycling-station'])
    let result = activate(state, station.id, ABILITY_KIND.BASIC)
    result = run(result.state, 0, { type: COMMAND_TYPE.CHOOSE_OPTION, promptId: result.state.prompt!.id, index: 0 })
    expect(result.state.pools[RESOURCE.TRADE]).toBe(1)
  })

  it('battlecruiser: утилизация берёт карту и разрешает уничтожить базу', () => {
    const state = newGame()
    const [ship] = setInPlay(state, 0, ['battlecruiser'])
    const [target] = setInPlay(state, 1, ['barter-world'])
    state.players[0].hand = []
    state.players[0].deck = [inst('scout')]
    let result = activate(state, ship.id, ABILITY_KIND.SCRAP)
    result = pick(result.state, target.id)
    expect(result.state.players[1].inPlay).toHaveLength(0)
    expect(result.state.players[0].hand).toHaveLength(1)
  })
})
