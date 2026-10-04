import type { CardInstance, Effect } from './card.ts'
import type { PROMPT_KIND, ScrapZone, SpendableResource, UsableAbility } from './constants.ts'

export type PlayerId = 0 | 1

export type Pools = Record<SpendableResource, number>
export type AbilityUsage = Record<UsableAbility, boolean>

export interface PlayedCard {
  card: CardInstance
  used: AbilityUsage
  /** Карта скопировала другой корабль (Stealth Needle): cardId копируемой карты. */
  copyOf?: string
}

export interface PlayerState {
  authority: number
  /** Верх колоды - индекс 0. */
  deck: CardInstance[]
  hand: CardInstance[]
  discard: CardInstance[]
  /** Корабли текущего хода и базы, оставшиеся на столе. */
  inPlay: PlayedCard[]
}

export type PromptSpec
  = | { kind: typeof PROMPT_KIND.CHOICE, player: PlayerId, source: string | null, options: Effect[][] }
  /**
   * Сброс карты из руки. Обязательный - по требованию соперника; необязательный (optional) - свой сброс
   * до remaining карт, после каждой можно взять по карте (drawPerDiscard).
   */
    | { kind: typeof PROMPT_KIND.DISCARD, player: PlayerId, source: string | null, optional?: boolean, remaining?: number, drawPerDiscard?: boolean }
    | { kind: typeof PROMPT_KIND.SCRAP, player: PlayerId, source: string | null, zones: ScrapZone[], optional: boolean, remaining?: number, drawPerScrap?: boolean }
    | { kind: typeof PROMPT_KIND.DESTROY_BASE, player: PlayerId, source: string | null, optional: boolean }
    | { kind: typeof PROMPT_KIND.ACQUIRE_SHIP, player: PlayerId, source: string | null }
    | { kind: typeof PROMPT_KIND.COPY_SHIP, player: PlayerId, source: string | null }

/** Запрос выбора. Пока он открыт, разрешены только ответы игрока prompt.player. */
export type Prompt = PromptSpec & { id: number }

export interface GameState {
  /** Растёт на 1 после каждой успешной команды. */
  version: number
  /** Внутреннее состояние генератора случайных чисел. Клиентам не отправляется. */
  rngState: number
  promptCounter: number
  players: [PlayerState, PlayerState]
  currentPlayer: PlayerId
  turn: number
  /** Пулы торговли и атаки текущего игрока. */
  pools: Pools
  /** Верх колоды - индекс 0. */
  tradeDeck: CardInstance[]
  /** Всегда 5 слотов; null, если колода пуста и слот не пополнить. */
  tradeRow: (CardInstance | null)[]
  explorers: CardInstance[]
  scrapHeap: CardInstance[]
  /** Следующий корабль, полученный в этот ход, ляжет на верх колоды (Freighter, Central Office). */
  nextShipToDeckTop: boolean
  /** cardId всех карт, сыгранных текущим игроком в этот ход (для эффектов «за каждую сыгранную карту»). */
  playedThisTurn: string[]
  prompt: Prompt | null
  /** Эффекты, которые надо выполнить после ответа на prompt. */
  continuation: Effect[]
  winner: PlayerId | null
}
