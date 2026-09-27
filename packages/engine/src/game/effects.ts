import type { Rng } from '../lib/rng.ts'
import type { AbilityUsage, CardInstance, Effect, GameEvent, GameState, PlayerId, Pools, PromptSpec, Resource, ScrapZone, SpendableResource } from '../types/index.ts'
import { ABILITY_KIND, EFFECT_TYPE, EVENT_TYPE, PROMPT_KIND, RESOURCE, SCRAP_ZONE } from '../types/index.ts'

/** Изменяемый контекст выполнения одной команды: apply работает над клоном состояния. */
export interface Ctx {
  state: GameState
  events: GameEvent[]
  rng: Rng
}

export interface ScrapCandidate {
  card: CardInstance
  zone: ScrapZone
}

export function other(player: PlayerId): PlayerId {
  return player === 0 ? 1 : 0
}

export function removeById(list: CardInstance[], id: string): CardInstance | undefined {
  const index = list.findIndex(card => card.id === id)
  return index === -1 ? undefined : list.splice(index, 1)[0]
}

export function gain(ctx: Ctx, player: PlayerId, resource: Resource, amount: number): void {
  if (amount === 0)
    return
  if (resource === RESOURCE.AUTHORITY)
    ctx.state.players[player].authority += amount
  else
    ctx.state.pools[resource] += amount
  ctx.events.push({ type: EVENT_TYPE.RESOURCE_GAINED, player, resource, amount })
}

export function spend(ctx: Ctx, player: PlayerId, resource: SpendableResource, amount: number): void {
  if (amount === 0)
    return
  ctx.state.pools[resource] -= amount
  ctx.events.push({ type: EVENT_TYPE.RESOURCE_SPENT, player, resource, amount })
}

/** Берёт карты; если колода кончилась, перемешивает сброс в новую колоду. */
export function drawCards(ctx: Ctx, player: PlayerId, count: number): void {
  const p = ctx.state.players[player]
  let drawn: CardInstance[] = []

  const flush = (): void => {
    if (drawn.length === 0)
      return
    ctx.events.push({ type: EVENT_TYPE.CARDS_DRAWN, player, count: drawn.length, cards: drawn })
    drawn = []
  }

  for (let i = 0; i < count; i++) {
    if (p.deck.length === 0) {
      if (p.discard.length === 0)
        break
      flush()
      p.deck = ctx.rng.shuffle(p.discard)
      p.discard = []
      ctx.events.push({ type: EVENT_TYPE.DECK_SHUFFLED, player, count: p.deck.length })
    }
    const card = p.deck.shift()!
    p.hand.push(card)
    drawn.push(card)
  }
  flush()
}

/** Выкладывает в слот верхнюю карту Торговой колоды; если колода пуста, слот остаётся пустым. */
export function refillTradeRow(ctx: Ctx, slot: number): void {
  const card = ctx.state.tradeDeck.shift() ?? null
  ctx.state.tradeRow[slot] = card
  if (card)
    ctx.events.push({ type: EVENT_TYPE.TRADE_ROW_REFILLED, slot, card })
}

export function scrapCandidates(state: GameState, actor: PlayerId, zones: readonly ScrapZone[]): ScrapCandidate[] {
  const result: ScrapCandidate[] = []
  for (const zone of zones) {
    if (zone === SCRAP_ZONE.HAND)
      result.push(...state.players[actor].hand.map(card => ({ card, zone })))
    else if (zone === SCRAP_ZONE.DISCARD)
      result.push(...state.players[actor].discard.map(card => ({ card, zone })))
    else
      result.push(...state.tradeRow.filter(card => card !== null).map(card => ({ card, zone })))
  }
  return result
}

/** Утилизирует карту из одной из разрешённых зон. Возвращает false, если карты там нет. */
export function scrapChosenCard(ctx: Ctx, actor: PlayerId, cardId: string, zones: readonly ScrapZone[]): boolean {
  const candidate = scrapCandidates(ctx.state, actor, zones).find(c => c.card.id === cardId)
  if (!candidate)
    return false

  const { state } = ctx
  let slot = -1
  if (candidate.zone === SCRAP_ZONE.HAND) {
    removeById(state.players[actor].hand, cardId)
  }
  else if (candidate.zone === SCRAP_ZONE.DISCARD) {
    removeById(state.players[actor].discard, cardId)
  }
  else {
    slot = state.tradeRow.findIndex(card => card?.id === cardId)
    state.tradeRow[slot] = null
  }

  state.scrapHeap.push(candidate.card)
  ctx.events.push({ type: EVENT_TYPE.CARD_SCRAPPED, player: actor, card: candidate.card, from: candidate.zone })
  if (slot !== -1)
    refillTradeRow(ctx, slot)
  return true
}

function openPrompt(ctx: Ctx, spec: PromptSpec, rest: Effect[]): void {
  const { state } = ctx
  state.promptCounter += 1
  state.prompt = { ...spec, id: state.promptCounter }
  state.continuation = rest
  ctx.events.push({ type: EVENT_TYPE.PROMPT_OPENED, prompt: state.prompt })
}

/** Закрывает открытый prompt и возвращает эффекты, которые надо доиграть. */
export function closePrompt(ctx: Ctx): Effect[] {
  const { state } = ctx
  const rest = state.continuation
  const promptId = state.prompt!.id
  state.prompt = null
  state.continuation = []
  ctx.events.push({ type: EVENT_TYPE.PROMPT_RESOLVED, promptId })
  return rest
}

/**
 * Выполняет эффекты текущего игрока по порядку. На первом эффекте, требующем выбора,
 * открывает prompt, сохраняет остаток в state.continuation и останавливается.
 */
export function resolveEffects(ctx: Ctx, effects: readonly Effect[], source: string | null): void {
  const { state } = ctx
  const actor = state.currentPlayer

  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i]!
    const rest = effects.slice(i + 1)

    switch (effect.type) {
      case EFFECT_TYPE.GAIN:
        gain(ctx, actor, effect.resource, effect.amount)
        break
      case EFFECT_TYPE.DRAW:
        drawCards(ctx, actor, effect.amount)
        break
      case EFFECT_TYPE.OPPONENT_DISCARD: {
        const opponent = other(actor)
        if (state.players[opponent].hand.length === 0)
          break
        const remaining = effect.amount > 1 ? [{ ...effect, amount: effect.amount - 1 }, ...rest] : rest
        openPrompt(ctx, { kind: PROMPT_KIND.DISCARD, player: opponent, source }, remaining)
        return
      }
      case EFFECT_TYPE.SCRAP:
        if (scrapCandidates(state, actor, effect.from).length === 0)
          break
        openPrompt(ctx, { kind: PROMPT_KIND.SCRAP, player: actor, source, zones: effect.from, optional: effect.optional }, rest)
        return
      case EFFECT_TYPE.CHOICE:
        openPrompt(ctx, { kind: PROMPT_KIND.CHOICE, player: actor, source, options: effect.options }, rest)
        return
    }
  }
}

/** Пустые пулы хода. Ключи берутся из RESOURCE, а не из литералов. */
export function emptyPools(): Pools {
  return { [RESOURCE.TRADE]: 0, [RESOURCE.COMBAT]: 0 }
}

/** Флаги «способность использована» для только что сыгранной карты. */
export function freshUsage(): AbilityUsage {
  return { [ABILITY_KIND.BASIC]: false, [ABILITY_KIND.ALLY]: false }
}
