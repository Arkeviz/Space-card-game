import type { CardInstance, GameState, PlayerState } from '@space/engine'
import { createGame, createRng, EXPLORER_CARD_ID, EXPLORER_COUNT, TRADE_DECK_COMPOSITION } from '@space/engine'

/*
 * Начальное состояние учебной партии. Это обычная партия движка, но руки, колоды и рынок подобраны заранее, чтобы
 * каждый ход показывал своё: покупка, база, союзник, аванпост. Игрок ходит первым (3 карты в первой руке).
 *
 * Единственное случайное место - перетасовка сброса в конце второго хода игрока. LESSON_RNG_STATE подобран так,
 * чтобы при любом порядке, в котором игрок разыграл карты первого хода, в новую руку вернулись Катер и Рыночный мир
 * (их игрок покупает в первый и второй ход). Если сменится генератор случайных чисел или порядок сброса, тест
 * lesson.test.ts подскажет, что значение нужно подобрать заново.
 */
export const LESSON_RNG_STATE = 2

/** Рынок в начале партии (слева направо). */
export const LESSON_ROW = ['trade-pod', 'cutter', 'imperial-frigate', 'barter-world', 'battle-blob'] as const

/**
 * Что выложится на рынок на месте купленных карт, в порядке покупок: Катер (игрок), Имперский фрегат (соперник),
 * Рыночный мир (игрок). Все дороже 1: рядом с оставшейся торговлей не будет ложных соблазнов.
 */
const REFILLS = ['patrol-mech', 'embassy-yacht', 'blob-destroyer'] as const

const PLAYER_HAND = ['scout', 'scout', 'viper'] as const
/** Верх колоды игрока: рука второго хода (пять Разведчиков), затем две карты, которые лягут в руку третьего хода. */
const PLAYER_DECK = ['scout', 'scout', 'scout', 'scout', 'scout', 'viper', 'scout'] as const
const OPPONENT_HAND = ['scout', 'scout', 'scout', 'viper', 'viper'] as const
/** Рука второго хода соперника: он выкладывает аванпост и копит на Исследователей. */
const OPPONENT_DECK = ['scout', 'scout', 'scout', 'scout', 'recycling-station'] as const

export function createLessonGame(): GameState {
  const base = createGame(1, { firstPlayer: 0 })
  let counter = 0
  const make = (cardId: string): CardInstance => ({ id: `l${counter++}`, cardId })
  const makeMany = (cardIds: readonly string[]): CardInstance[] => cardIds.map(make)
  const player = (hand: readonly string[], deck: readonly string[]): PlayerState => ({
    authority: base.players[0].authority,
    hand: makeMany(hand),
    deck: makeMany(deck),
    discard: [],
    inPlay: [],
  })

  const players: [PlayerState, PlayerState] = [player(PLAYER_HAND, PLAYER_DECK), player(OPPONENT_HAND, OPPONENT_DECK)]
  const tradeRow = makeMany(LESSON_ROW)

  // Остальная торговая колода - все карты набора, кроме выложенных на рынок, в фиксированном порядке; сверху - заготовленные.
  const rest = Object.entries(TRADE_DECK_COMPOSITION).flatMap(([cardId, count]) => Array.from<string>({ length: count }).fill(cardId))
  for (const cardId of LESSON_ROW)
    rest.splice(rest.indexOf(cardId), 1)
  const shuffled = createRng(7).shuffle(rest)
  for (const cardId of REFILLS)
    shuffled.splice(shuffled.indexOf(cardId), 1)
  const tradeDeck = makeMany([...REFILLS, ...shuffled])

  return {
    ...base,
    rngState: LESSON_RNG_STATE,
    players,
    tradeRow,
    tradeDeck,
    explorers: makeMany(Array.from<string>({ length: EXPLORER_COUNT }).fill(EXPLORER_CARD_ID)),
  }
}
