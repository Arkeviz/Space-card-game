import type { Rng } from '../lib/rng.ts'
import type { AbilityUsage, Card, CardInstance, Effect, Faction, GameEvent, GameState, PassiveType, PlayedCard, PlayerId, PlayerState, Pools, PromptSpec, Resource, ScrapZone, SpendableResource } from '../types/index.ts'
import { getCard } from '../data/cards.ts'
import { ABILITY_KIND, CARD_KIND, EFFECT_TYPE, EVENT_TYPE, FACTION, PASSIVE_TYPE, PROMPT_KIND, RESOURCE, SCRAP_ZONE } from '../types/index.ts'

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

/* ---------- Карты на столе: эффективная карта, фракции, постоянные свойства ---------- */

/** Карта, по которой работают способности: у скопировавшей корабль (Stealth Needle) это копируемая карта. */
export function effectiveCard(entry: PlayedCard): Card {
  return getCard(entry.copyOf ?? entry.card.cardId)
}

/** База или аванпост (не корабль). */
export function isBaseLike(entry: PlayedCard): boolean {
  return getCard(entry.card.cardId).kind !== CARD_KIND.SHIP
}

/** Фракции карты на столе: своя плюс скопированная; нейтральная фракция союзников не даёт. */
function factionsOf(entry: PlayedCard): Faction[] {
  const own = getCard(entry.card.cardId).faction
  const copied = entry.copyOf ? getCard(entry.copyOf).faction : own
  return [...new Set([own, copied])].filter(faction => faction !== FACTION.NEUTRAL)
}

export function hasPassive(entries: readonly PlayedCard[], type: PassiveType): boolean {
  return entries.some(entry => getCard(entry.card.cardId).passives?.some(passive => passive.type === type))
}

/** Есть ли в игре другая карта той же фракции (условие способности союзника). */
export function hasAlly(player: PlayerState, played: PlayedCard): boolean {
  const mine = factionsOf(played)
  if (mine.length === 0)
    return false
  const others = player.inPlay.filter(entry => entry !== played)
  // Mech World считается союзником для всех фракций.
  if (hasPassive(others, PASSIVE_TYPE.ALL_FACTIONS))
    return true
  return others.some(entry => factionsOf(entry).some(faction => mine.includes(faction)))
}

/* ---------- Цели эффектов ---------- */

/** Базы и аванпосты соперника: уничтожить эффектом можно любую, аванпосты от эффектов не защищают. */
export function destroyCandidates(state: GameState, actor: PlayerId): CardInstance[] {
  return state.players[other(actor)].inPlay.filter(isBaseLike).map(entry => entry.card)
}

export interface AcquireCandidate {
  card: CardInstance
  from: 'trade-row' | 'explorers'
  slot: number | null
}

/** Корабли, которые можно получить бесплатно: из Торгового ряда и верхний Исследователь. */
export function acquireCandidates(state: GameState): AcquireCandidate[] {
  const result: AcquireCandidate[] = []
  state.tradeRow.forEach((card, slot) => {
    if (card && getCard(card.cardId).kind === CARD_KIND.SHIP)
      result.push({ card, from: 'trade-row', slot })
  })
  const explorer = state.explorers[0]
  if (explorer)
    result.push({ card: explorer, from: 'explorers', slot: null })
  return result
}

/** Корабли, сыгранные в этот ход (кроме самой копирующей карты): их можно скопировать. */
export function copyCandidates(state: GameState, actor: PlayerId, sourceId: string | null): PlayedCard[] {
  return state.players[actor].inPlay.filter(entry => !isBaseLike(entry) && entry.card.id !== sourceId)
}

export function destroyBase(ctx: Ctx, actor: PlayerId, cardId: string): boolean {
  const opponent = ctx.state.players[other(actor)]
  const target = opponent.inPlay.find(entry => entry.card.id === cardId && isBaseLike(entry))
  if (!target)
    return false
  opponent.inPlay = opponent.inPlay.filter(entry => entry !== target)
  opponent.discard.push(target.card)
  ctx.events.push({ type: EVENT_TYPE.BASE_DESTROYED, owner: other(actor), card: target.card })
  return true
}

/** Получает корабль бесплатно и кладёт его на верх колоды игрока. */
export function acquireShip(ctx: Ctx, actor: PlayerId, cardId: string): boolean {
  const { state } = ctx
  const candidate = acquireCandidates(state).find(item => item.card.id === cardId)
  if (!candidate)
    return false
  if (candidate.from === 'explorers')
    state.explorers.shift()
  else
    state.tradeRow[candidate.slot!] = null
  state.players[actor].deck.unshift(candidate.card)
  ctx.events.push({ type: EVENT_TYPE.CARD_ACQUIRED, player: actor, card: candidate.card, from: candidate.from, slot: candidate.slot })
  if (candidate.slot !== null)
    refillTradeRow(ctx, candidate.slot)
  return true
}

/** Копирует корабль: возвращает его базовые эффекты, которые нужно выполнить, или null, если цели нет. */
export function copyShip(ctx: Ctx, actor: PlayerId, sourceId: string | null, targetCardId: string): Effect[] | null {
  const own = ctx.state.players[actor].inPlay.find(entry => entry.card.id === sourceId)
  const target = copyCandidates(ctx.state, actor, sourceId).find(entry => entry.card.id === targetCardId)
  if (!own || !target)
    return null
  const copied = effectiveCard(target)
  own.copyOf = copied.id
  ctx.events.push({ type: EVENT_TYPE.SHIP_COPIED, player: actor, cardId: own.card.id, copyOf: copied.id })
  return copied.abilities[ABILITY_KIND.BASIC] ?? []
}

/* ---------- Запросы выбора ---------- */

export function openPrompt(ctx: Ctx, spec: PromptSpec, rest: Effect[]): void {
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
        // Соперник сбросит карты в начале своего хода (openPendingDiscard), а не посреди хода текущего игрока.
        const opponent = other(actor)
        state.pendingDiscards[opponent] += effect.amount
        ctx.events.push({ type: EVENT_TYPE.DISCARD_QUEUED, player: opponent, amount: effect.amount })
        break
      }
      case EFFECT_TYPE.SCRAP:
        if (scrapCandidates(state, actor, effect.from).length === 0)
          break
        openPrompt(ctx, { kind: PROMPT_KIND.SCRAP, player: actor, source, zones: effect.from, optional: effect.optional, remaining: effect.repeat, drawPerScrap: effect.drawPerScrap }, rest)
        return
      case EFFECT_TYPE.CHOICE:
        openPrompt(ctx, { kind: PROMPT_KIND.CHOICE, player: actor, source, options: effect.options }, rest)
        return
      case EFFECT_TYPE.DESTROY_BASE:
        if (destroyCandidates(state, actor).length === 0)
          break
        openPrompt(ctx, { kind: PROMPT_KIND.DESTROY_BASE, player: actor, source, optional: effect.optional }, rest)
        return
      case EFFECT_TYPE.ACQUIRE_SHIP:
        if (acquireCandidates(state).length === 0)
          break
        openPrompt(ctx, { kind: PROMPT_KIND.ACQUIRE_SHIP, player: actor, source }, rest)
        return
      case EFFECT_TYPE.SHIP_TO_DECK_TOP:
        state.nextShipToDeckTop = true
        break
      case EFFECT_TYPE.DRAW_IF_BASES:
        if (state.players[actor].inPlay.filter(isBaseLike).length >= effect.minBases)
          drawCards(ctx, actor, effect.amount)
        break
      case EFFECT_TYPE.DRAW_PER_PLAYED: {
        const played = state.playedThisTurn.filter(cardId => getCard(cardId).faction === effect.faction).length
        if (played > 0)
          drawCards(ctx, actor, played)
        break
      }
      case EFFECT_TYPE.DISCARD_DRAW:
        if (state.players[actor].hand.length === 0)
          break
        openPrompt(ctx, { kind: PROMPT_KIND.DISCARD, player: actor, source, optional: true, remaining: effect.max, drawPerDiscard: true }, rest)
        return
      case EFFECT_TYPE.COPY_SHIP:
        if (copyCandidates(state, actor, source).length === 0)
          break
        openPrompt(ctx, { kind: PROMPT_KIND.COPY_SHIP, player: actor, source }, rest)
        return
    }
  }
}

/** Эффекты, которым нужен выбор игрока: такие способности остаются ручными (активируются командой ACTIVATE). */
const INTERACTIVE_EFFECTS = new Set<Effect['type']>([
  EFFECT_TYPE.SCRAP,
  EFFECT_TYPE.CHOICE,
  EFFECT_TYPE.DESTROY_BASE,
  EFFECT_TYPE.ACQUIRE_SHIP,
  EFFECT_TYPE.DISCARD_DRAW,
  EFFECT_TYPE.COPY_SHIP,
])

/** «Простая» способность: ни один из её эффектов не просит выбора, поэтому она срабатывает сама. */
export function isAutomatic(effects: readonly Effect[]): boolean {
  return effects.every(effect => !INTERACTIVE_EFFECTS.has(effect.type))
}

/**
 * Срабатывание простых способностей у карт игрока на столе: основной способности баз и аванпостов и способности
 * союзника (если условие выполнено), пока они ещё не использованы. Вызывается, когда на столе появилась новая карта
 * (розыгрыш, копирование) и в начале хода игрока (для баз, оставшихся с прошлого хода). Простые эффекты prompt не
 * открывают, поэтому цепочка не прерывается. Основные способности кораблей здесь не участвуют: они срабатывают
 * в playCard.
 */
export function triggerAutomatic(ctx: Ctx, player: PlayerId): void {
  const p = ctx.state.players[player]
  for (const played of p.inPlay) {
    const abilities = effectiveCard(played).abilities
    const basic = abilities[ABILITY_KIND.BASIC]
    if (isBaseLike(played) && !played.used[ABILITY_KIND.BASIC] && basic && isAutomatic(basic))
      fire(ctx, player, played, ABILITY_KIND.BASIC, basic)

    const ally = abilities[ABILITY_KIND.ALLY]
    if (!played.used[ABILITY_KIND.ALLY] && ally && isAutomatic(ally) && hasAlly(p, played))
      fire(ctx, player, played, ABILITY_KIND.ALLY, ally)
  }
}

function fire(ctx: Ctx, player: PlayerId, played: PlayedCard, ability: typeof ABILITY_KIND.BASIC | typeof ABILITY_KIND.ALLY, effects: readonly Effect[]): void {
  played.used[ability] = true
  ctx.events.push({ type: EVENT_TYPE.ABILITY_ACTIVATED, player, cardId: played.card.id, ability })
  resolveEffects(ctx, effects, played.card.id)
}

/** Начало хода: игрок, которому соперник велел сбросить карты, выбирает их. Если рука пуста, долг сгорает. */
export function openPendingDiscard(ctx: Ctx, player: PlayerId): void {
  const { state } = ctx
  const owed = state.pendingDiscards[player]
  state.pendingDiscards[player] = 0
  const handSize = state.players[player].hand.length
  if (owed === 0 || handSize === 0)
    return
  openPrompt(ctx, { kind: PROMPT_KIND.DISCARD, player, source: null, remaining: Math.min(owed, handSize) }, [])
}

/** Пустые пулы хода. Ключи берутся из RESOURCE, а не из литералов. */
export function emptyPools(): Pools {
  return { [RESOURCE.TRADE]: 0, [RESOURCE.COMBAT]: 0 }
}

/** Флаги «способность использована» для только что сыгранной карты. */
export function freshUsage(): AbilityUsage {
  return { [ABILITY_KIND.BASIC]: false, [ABILITY_KIND.ALLY]: false }
}
