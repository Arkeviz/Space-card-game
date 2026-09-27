import type { AbilityKind, ApplyResult, Command, CommandError, CommandType, GameState, PlayedCard, PlayerId, PlayerState } from '../types/index.ts'
import type { Ctx } from './effects.ts'
import { getCard } from '../data/cards.ts'
import { HAND_SIZE } from '../data/config.ts'
import { createRng } from '../lib/rng.ts'
import { ABILITY_KIND, CARD_KIND, COMMAND_ERROR, COMMAND_TYPE, EVENT_TYPE, FACTION, PROMPT_KIND, RESOURCE } from '../types/index.ts'
import {
  closePrompt,
  drawCards,
  emptyPools,
  freshUsage,
  other,
  refillTradeRow,
  removeById,
  resolveEffects,
  scrapChosenCard,
  spend,
} from './effects.ts'

const PROMPT_COMMANDS = new Set<CommandType>([COMMAND_TYPE.CHOOSE_OPTION, COMMAND_TYPE.CHOOSE_CARD, COMMAND_TYPE.SKIP])

/** Есть ли в игре другая карта той же фракции (условие способности союзника). */
function hasAlly(player: PlayerState, played: PlayedCard): boolean {
  const faction = getCard(played.card.cardId).faction
  if (faction === FACTION.NEUTRAL)
    return false
  return player.inPlay.some(entry => entry !== played && getCard(entry.card.cardId).faction === faction)
}

function hasOutpost(player: PlayerState): boolean {
  return player.inPlay.some(entry => getCard(entry.card.cardId).kind === CARD_KIND.OUTPOST)
}

function playCard(ctx: Ctx, player: PlayerId, cardId: string): CommandError | null {
  const p = ctx.state.players[player]
  const instance = removeById(p.hand, cardId)
  if (!instance)
    return COMMAND_ERROR.CARD_NOT_FOUND

  const played: PlayedCard = { card: instance, used: freshUsage() }
  p.inPlay.push(played)
  ctx.events.push({ type: EVENT_TYPE.CARD_PLAYED, player, card: instance })

  const card = getCard(instance.cardId)
  if (card.kind === CARD_KIND.SHIP) {
    played.used[ABILITY_KIND.BASIC] = true
    resolveEffects(ctx, card.abilities[ABILITY_KIND.BASIC] ?? [], instance.id)
  }
  return null
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
  state.players[player].discard.push(card)
  ctx.events.push({ type: EVENT_TYPE.CARD_BOUGHT, player, card, from: 'trade-row', slot })
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
  state.players[player].discard.push(card)
  ctx.events.push({ type: EVENT_TYPE.CARD_BOUGHT, player, card, from: 'explorers', slot: null })
  return null
}

function activate(ctx: Ctx, player: PlayerId, cardId: string, ability: AbilityKind): CommandError | null {
  const p = ctx.state.players[player]
  const played = p.inPlay.find(entry => entry.card.id === cardId)
  if (!played)
    return COMMAND_ERROR.CARD_NOT_FOUND

  const card = getCard(played.card.cardId)
  const effects = card.abilities[ability]
  if (!effects)
    return COMMAND_ERROR.ABILITY_UNAVAILABLE

  if (ability === ABILITY_KIND.BASIC) {
    // Базовые эффекты кораблей срабатывают сами при розыгрыше.
    if (card.kind === CARD_KIND.SHIP)
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
  for (const entry of state.players[next].inPlay)
    entry.used = freshUsage()
  ctx.events.push({ type: EVENT_TYPE.TURN_STARTED, player: next, turn: state.turn })
  return null
}

function answerPrompt(ctx: Ctx, player: PlayerId, command: Extract<Command, { promptId: number }>): CommandError | null {
  const { state } = ctx
  const prompt = state.prompt!
  if (command.promptId !== prompt.id)
    return COMMAND_ERROR.WRONG_PROMPT

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
    if (prompt.kind !== PROMPT_KIND.SCRAP || !prompt.optional)
      return COMMAND_ERROR.INVALID_CHOICE
    resolveEffects(ctx, closePrompt(ctx), prompt.source)
    return null
  }

  if (prompt.kind === PROMPT_KIND.DISCARD) {
    const card = removeById(state.players[player].hand, command.cardId)
    if (!card)
      return COMMAND_ERROR.INVALID_CHOICE
    state.players[player].discard.push(card)
    ctx.events.push({ type: EVENT_TYPE.CARD_DISCARDED, player, card, from: 'hand' })
  }
  else if (prompt.kind === PROMPT_KIND.SCRAP) {
    if (!scrapChosenCard(ctx, player, command.cardId, prompt.zones))
      return COMMAND_ERROR.INVALID_CHOICE
  }
  else {
    return COMMAND_ERROR.INVALID_CHOICE
  }
  resolveEffects(ctx, closePrompt(ctx), prompt.source)
  return null
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
    case COMMAND_TYPE.CHOOSE_OPTION:
    case COMMAND_TYPE.CHOOSE_CARD:
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
