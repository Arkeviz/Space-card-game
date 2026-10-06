import type { AbilityKind, ApplyResult, CardInstance, Command, CommandError, CommandType, Destination, GameState, PlayedCard, PlayerId, PlayerState, Prompt } from '../types/index.ts'
import type { Ctx } from './effects.ts'
import { getCard } from '../data/cards.ts'
import { HAND_SIZE } from '../data/config.ts'
import { createRng } from '../lib/rng.ts'
import { ABILITY_KIND, CARD_KIND, COMMAND_ERROR, COMMAND_TYPE, DESTINATION, EVENT_TYPE, PASSIVE_TYPE, PROMPT_KIND, RESOURCE } from '../types/index.ts'
import {
  acquireShip,
  closePrompt,
  copyShip,
  destroyBase,
  drawCards,
  effectiveCard,
  emptyPools,
  freshUsage,
  gain,
  hasAlly,
  openPendingDiscard,
  openPrompt,
  other,
  refillTradeRow,
  removeById,
  resolveEffects,
  scrapCandidates,
  scrapChosenCard,
  spend,
  triggerAutomatic,
} from './effects.ts'

const PROMPT_COMMANDS = new Set<CommandType>([COMMAND_TYPE.CHOOSE_OPTION, COMMAND_TYPE.CHOOSE_CARD, COMMAND_TYPE.CHOOSE_CARDS, COMMAND_TYPE.SKIP])

function hasOutpost(player: PlayerState): boolean {
  return player.inPlay.some(entry => getCard(entry.card.cardId).kind === CARD_KIND.OUTPOST)
}

/** Сколько дополнительной атаки получает корабль, сыгранный сейчас (Fleet HQ и подобные постоянные свойства). */
function shipCombatBonus(entries: readonly PlayedCard[]): number {
  return entries.reduce((sum, entry) => {
    const passives = getCard(entry.card.cardId).passives ?? []
    return sum + passives.reduce((inner, passive) => (passive.type === PASSIVE_TYPE.SHIP_COMBAT_BONUS ? inner + passive.amount : inner), 0)
  }, 0)
}

function playCard(ctx: Ctx, player: PlayerId, cardId: string): CommandError | null {
  const p = ctx.state.players[player]
  const instance = removeById(p.hand, cardId)
  if (!instance)
    return COMMAND_ERROR.CARD_NOT_FOUND

  const played: PlayedCard = { card: instance, used: freshUsage() }
  const bonus = shipCombatBonus(p.inPlay)
  p.inPlay.push(played)
  ctx.state.playedThisTurn.push(instance.cardId)
  ctx.events.push({ type: EVENT_TYPE.CARD_PLAYED, player, card: instance })

  // Простые способности союзника срабатывают сразу: и у самой карты, и у тех, кому она стала союзником.
  triggerAutomatic(ctx, player)

  const card = getCard(instance.cardId)
  if (card.kind === CARD_KIND.SHIP) {
    played.used[ABILITY_KIND.BASIC] = true
    if (bonus > 0)
      gain(ctx, player, RESOURCE.COMBAT, bonus)
    resolveEffects(ctx, card.abilities[ABILITY_KIND.BASIC] ?? [], instance.id)
  }
  return null
}

/** Куда ложится купленная карта: обычно в сброс, а корабль после SHIP_TO_DECK_TOP - на верх колоды. */
function deliverBought(ctx: Ctx, player: PlayerId, card: CardInstance): Destination {
  const { state } = ctx
  if (state.nextShipToDeckTop && getCard(card.cardId).kind === CARD_KIND.SHIP) {
    state.nextShipToDeckTop = false
    state.players[player].deck.unshift(card)
    return DESTINATION.DECK_TOP
  }
  state.players[player].discard.push(card)
  return DESTINATION.DISCARD
}

function buyCard(ctx: Ctx, player: PlayerId, cardId: string): CommandError | null {
  const { state } = ctx
  const slot = state.tradeRow.findIndex(card => card?.id === cardId)
  const card = state.tradeRow[slot]
  if (!card)
    return COMMAND_ERROR.CARD_NOT_FOUND

  const cost = getCard(card.cardId).cost
  if (cost > state.pools[RESOURCE.TRADE])
    return COMMAND_ERROR.CANNOT_AFFORD

  spend(ctx, player, RESOURCE.TRADE, cost)
  state.tradeRow[slot] = null
  const to = deliverBought(ctx, player, card)
  ctx.events.push({ type: EVENT_TYPE.CARD_BOUGHT, player, card, from: 'trade-row', slot, to })
  refillTradeRow(ctx, slot)
  return null
}

function buyExplorer(ctx: Ctx, player: PlayerId): CommandError | null {
  const { state } = ctx
  const card = state.explorers[0]
  if (!card)
    return COMMAND_ERROR.CARD_NOT_FOUND

  const cost = getCard(card.cardId).cost
  if (cost > state.pools[RESOURCE.TRADE])
    return COMMAND_ERROR.CANNOT_AFFORD

  spend(ctx, player, RESOURCE.TRADE, cost)
  state.explorers.shift()
  const to = deliverBought(ctx, player, card)
  ctx.events.push({ type: EVENT_TYPE.CARD_BOUGHT, player, card, from: 'explorers', slot: null, to })
  return null
}

function activate(ctx: Ctx, player: PlayerId, cardId: string, ability: AbilityKind): CommandError | null {
  const p = ctx.state.players[player]
  const played = p.inPlay.find(entry => entry.card.id === cardId)
  if (!played)
    return COMMAND_ERROR.CARD_NOT_FOUND

  // Способности работают по эффективной карте: у скопировавшего корабль Stealth Needle это копия.
  const card = effectiveCard(played)
  const effects = card.abilities[ability]
  if (!effects)
    return COMMAND_ERROR.ABILITY_UNAVAILABLE

  if (ability === ABILITY_KIND.BASIC) {
    // Базовые эффекты кораблей срабатывают сами при розыгрыше.
    if (getCard(played.card.cardId).kind === CARD_KIND.SHIP)
      return COMMAND_ERROR.ABILITY_UNAVAILABLE
    if (played.used[ABILITY_KIND.BASIC])
      return COMMAND_ERROR.ABILITY_USED
    played.used[ABILITY_KIND.BASIC] = true
  }
  else if (ability === ABILITY_KIND.ALLY) {
    if (played.used[ABILITY_KIND.ALLY])
      return COMMAND_ERROR.ABILITY_USED
    if (!hasAlly(p, played))
      return COMMAND_ERROR.ABILITY_UNAVAILABLE
    played.used[ABILITY_KIND.ALLY] = true
  }
  else {
    p.inPlay = p.inPlay.filter(entry => entry !== played)
    ctx.state.scrapHeap.push(played.card)
    ctx.events.push({ type: EVENT_TYPE.CARD_SCRAPPED, player, card: played.card, from: 'play' })
  }

  ctx.events.push({ type: EVENT_TYPE.ABILITY_ACTIVATED, player, cardId, ability })
  resolveEffects(ctx, effects, cardId)
  return null
}

function attackBase(ctx: Ctx, player: PlayerId, cardId: string): CommandError | null {
  const { state } = ctx
  const opponent = other(player)
  const target = state.players[opponent]
  const played = target.inPlay.find(entry => entry.card.id === cardId)
  if (!played)
    return COMMAND_ERROR.CARD_NOT_FOUND

  const card = getCard(played.card.cardId)
  if (card.kind !== CARD_KIND.OUTPOST && hasOutpost(target))
    return COMMAND_ERROR.OUTPOST_BLOCKS

  const defense = card.defense ?? 0
  if (state.pools[RESOURCE.COMBAT] < defense)
    return COMMAND_ERROR.INSUFFICIENT_COMBAT

  spend(ctx, player, RESOURCE.COMBAT, defense)
  target.inPlay = target.inPlay.filter(entry => entry !== played)
  target.discard.push(played.card)
  ctx.events.push({ type: EVENT_TYPE.BASE_DESTROYED, owner: opponent, card: played.card })
  return null
}

function attackPlayer(ctx: Ctx, player: PlayerId, amount: number): CommandError | null {
  const { state } = ctx
  const opponent = other(player)
  if (!Number.isInteger(amount) || amount < 1 || amount > state.pools[RESOURCE.COMBAT])
    return COMMAND_ERROR.INVALID_AMOUNT
  if (hasOutpost(state.players[opponent]))
    return COMMAND_ERROR.OUTPOST_BLOCKS

  spend(ctx, player, RESOURCE.COMBAT, amount)
  state.players[opponent].authority -= amount
  ctx.events.push({ type: EVENT_TYPE.PLAYER_ATTACKED, attacker: player, target: opponent, amount })

  if (state.players[opponent].authority <= 0) {
    state.winner = player
    ctx.events.push({ type: EVENT_TYPE.GAME_OVER, winner: player })
  }
  return null
}

function concede(ctx: Ctx, player: PlayerId): CommandError | null {
  const winner = other(player)
  ctx.state.winner = winner
  ctx.events.push({ type: EVENT_TYPE.GAME_OVER, winner })
  return null
}

function endTurn(ctx: Ctx, player: PlayerId): CommandError | null {
  const { state } = ctx
  const p = state.players[player]
  ctx.events.push({ type: EVENT_TYPE.TURN_ENDED, player })

  for (const card of p.hand)
    ctx.events.push({ type: EVENT_TYPE.CARD_DISCARDED, player, card, from: 'hand' })
  p.discard.push(...p.hand)
  p.hand = []

  const isShip = (entry: PlayedCard): boolean => getCard(entry.card.cardId).kind === CARD_KIND.SHIP
  for (const entry of p.inPlay.filter(isShip)) {
    ctx.events.push({ type: EVENT_TYPE.CARD_DISCARDED, player, card: entry.card, from: 'play' })
    p.discard.push(entry.card)
  }
  p.inPlay = p.inPlay.filter(entry => !isShip(entry))

  // Новая рука берётся в конце своего хода: так эффекты сброса соперника видят настоящую руку.
  drawCards(ctx, player, HAND_SIZE)

  const next = other(player)
  state.currentPlayer = next
  state.turn += 1
  state.pools = emptyPools()
  state.playedThisTurn = []
  state.nextShipToDeckTop = false
  for (const entry of state.players[next].inPlay)
    entry.used = freshUsage()
  ctx.events.push({ type: EVENT_TYPE.TURN_STARTED, player: next, turn: state.turn })

  // Базы с прошлых ходов уже имеют союзников: их простые способности срабатывают сразу, потом - обязательный сброс.
  triggerAutomatic(ctx, next)
  openPendingDiscard(ctx, next)
  return null
}

/** Продолжение цепочки «утилизируйте/сбросьте до N карт»: следующий запрос или остаток эффектов. */
function repeatOrFinish(ctx: Ctx, prompt: Extract<Prompt, { kind: typeof PROMPT_KIND.DISCARD | typeof PROMPT_KIND.SCRAP }>, player: PlayerId): CommandError | null {
  const { state } = ctx
  const remaining = (prompt.remaining ?? 1) - 1
  const hasMore = prompt.kind === PROMPT_KIND.DISCARD
    ? state.players[player].hand.length > 0
    : scrapCandidates(state, player, prompt.zones).length > 0
  if (remaining > 0 && hasMore) {
    const rest = closePrompt(ctx)
    openPrompt(ctx, { ...prompt, remaining }, rest)
    return null
  }
  resolveEffects(ctx, closePrompt(ctx), prompt.source)
  return null
}

/**
 * Сброс нескольких карт одним ответом. Обязательный запрос требует ровно столько карт, сколько осталось сбросить
 * (но не больше, чем карт в руке), необязательный - от одной до этого числа. Цепочка запроса на этом заканчивается.
 */
function discardMany(ctx: Ctx, player: PlayerId, prompt: Prompt, cardIds: readonly string[]): CommandError | null {
  if (prompt.kind !== PROMPT_KIND.DISCARD)
    return COMMAND_ERROR.INVALID_CHOICE
  const { hand } = ctx.state.players[player]
  const limit = Math.min(prompt.remaining ?? 1, hand.length)
  const distinct = new Set(cardIds).size === cardIds.length
  const inHand = cardIds.every(id => hand.some(card => card.id === id))
  const countOk = prompt.optional ? cardIds.length >= 1 && cardIds.length <= limit : cardIds.length === limit
  if (!distinct || !inHand || !countOk)
    return COMMAND_ERROR.INVALID_CHOICE

  for (const id of cardIds) {
    const card = removeById(hand, id)!
    ctx.state.players[player].discard.push(card)
    ctx.events.push({ type: EVENT_TYPE.CARD_DISCARDED, player, card, from: 'hand' })
    if (prompt.drawPerDiscard)
      drawCards(ctx, player, 1)
  }
  resolveEffects(ctx, closePrompt(ctx), prompt.source)
  return null
}

function answerPrompt(ctx: Ctx, player: PlayerId, command: Extract<Command, { promptId: number }>): CommandError | null {
  const { state } = ctx
  const prompt = state.prompt!
  if (command.promptId !== prompt.id)
    return COMMAND_ERROR.WRONG_PROMPT

  if (command.type === COMMAND_TYPE.CHOOSE_CARDS)
    return discardMany(ctx, player, prompt, command.cardIds)

  if (command.type === COMMAND_TYPE.CHOOSE_OPTION) {
    if (prompt.kind !== PROMPT_KIND.CHOICE)
      return COMMAND_ERROR.INVALID_CHOICE
    const option = prompt.options[command.index]
    if (!Number.isInteger(command.index) || !option)
      return COMMAND_ERROR.INVALID_CHOICE
    const rest = closePrompt(ctx)
    resolveEffects(ctx, [...option, ...rest], prompt.source)
    return null
  }

  if (command.type === COMMAND_TYPE.SKIP) {
    // Пропустить можно только необязательный запрос; на этом цепочка (до N карт) заканчивается.
    const skippable = (prompt.kind === PROMPT_KIND.SCRAP || prompt.kind === PROMPT_KIND.DESTROY_BASE || prompt.kind === PROMPT_KIND.DISCARD) && prompt.optional
    if (!skippable)
      return COMMAND_ERROR.INVALID_CHOICE
    resolveEffects(ctx, closePrompt(ctx), prompt.source)
    return null
  }

  switch (prompt.kind) {
    case PROMPT_KIND.DISCARD: {
      const card = removeById(state.players[player].hand, command.cardId)
      if (!card)
        return COMMAND_ERROR.INVALID_CHOICE
      state.players[player].discard.push(card)
      ctx.events.push({ type: EVENT_TYPE.CARD_DISCARDED, player, card, from: 'hand' })
      if (prompt.drawPerDiscard)
        drawCards(ctx, player, 1)
      return repeatOrFinish(ctx, prompt, player)
    }
    case PROMPT_KIND.SCRAP:
      if (!scrapChosenCard(ctx, player, command.cardId, prompt.zones))
        return COMMAND_ERROR.INVALID_CHOICE
      if (prompt.drawPerScrap)
        drawCards(ctx, player, 1)
      return repeatOrFinish(ctx, prompt, player)
    case PROMPT_KIND.DESTROY_BASE:
      if (!destroyBase(ctx, player, command.cardId))
        return COMMAND_ERROR.INVALID_CHOICE
      resolveEffects(ctx, closePrompt(ctx), prompt.source)
      return null
    case PROMPT_KIND.ACQUIRE_SHIP:
      if (!acquireShip(ctx, player, command.cardId))
        return COMMAND_ERROR.INVALID_CHOICE
      resolveEffects(ctx, closePrompt(ctx), prompt.source)
      return null
    case PROMPT_KIND.COPY_SHIP: {
      const copied = copyShip(ctx, player, prompt.source, command.cardId)
      if (copied === null)
        return COMMAND_ERROR.INVALID_CHOICE
      // Скопированная фракция может сделать корабль союзником (и наоборот).
      triggerAutomatic(ctx, player)
      const rest = closePrompt(ctx)
      resolveEffects(ctx, [...copied, ...rest], prompt.source)
      return null
    }
    default:
      return COMMAND_ERROR.INVALID_CHOICE
  }
}

function execute(ctx: Ctx, player: PlayerId, command: Command): CommandError | null {
  switch (command.type) {
    case COMMAND_TYPE.PLAY_CARD: return playCard(ctx, player, command.cardId)
    case COMMAND_TYPE.BUY: return buyCard(ctx, player, command.cardId)
    case COMMAND_TYPE.BUY_EXPLORER: return buyExplorer(ctx, player)
    case COMMAND_TYPE.ACTIVATE: return activate(ctx, player, command.cardId, command.ability)
    case COMMAND_TYPE.ATTACK_PLAYER: return attackPlayer(ctx, player, command.amount)
    case COMMAND_TYPE.ATTACK_BASE: return attackBase(ctx, player, command.cardId)
    case COMMAND_TYPE.END_TURN: return endTurn(ctx, player)
    case COMMAND_TYPE.CONCEDE: return concede(ctx, player)
    case COMMAND_TYPE.CHOOSE_OPTION:
    case COMMAND_TYPE.CHOOSE_CARD:
    case COMMAND_TYPE.CHOOSE_CARDS:
    case COMMAND_TYPE.SKIP: return answerPrompt(ctx, player, command)
  }
}

/**
 * Применяет команду игрока. Чистая функция: исходное состояние не изменяется,
 * при ошибке возвращается только код ошибки, при успехе - новое состояние и события.
 */
export function apply(state: GameState, player: PlayerId, command: Command): ApplyResult {
  if (state.winner !== null)
    return { ok: false, error: COMMAND_ERROR.GAME_OVER }

  // CONCEDE - единственная команда, доступная независимо от того, чей ход и открыт ли prompt.
  if (command.type !== COMMAND_TYPE.CONCEDE) {
    const isPromptCommand = PROMPT_COMMANDS.has(command.type)
    if (state.prompt) {
      if (!isPromptCommand)
        return { ok: false, error: COMMAND_ERROR.PROMPT_PENDING }
      if (state.prompt.player !== player)
        return { ok: false, error: COMMAND_ERROR.NOT_YOUR_TURN }
    }
    else {
      if (isPromptCommand)
        return { ok: false, error: COMMAND_ERROR.NO_PROMPT }
      if (player !== state.currentPlayer)
        return { ok: false, error: COMMAND_ERROR.NOT_YOUR_TURN }
    }
  }

  // Состояние - чистый JSON (его же сервер сохраняет и отправляет), поэтому клонируем через JSON.
  const next = JSON.parse(JSON.stringify(state)) as GameState
  const rng = createRng(next.rngState)
  const ctx: Ctx = { state: next, events: [], rng }

  const error = execute(ctx, player, command)
  if (error)
    return { ok: false, error }

  next.rngState = rng.state()
  next.version += 1
  return { ok: true, state: next, events: ctx.events }
}
