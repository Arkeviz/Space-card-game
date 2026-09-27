import type { Command, GameState, PlayerId } from '../types/index.ts'
import { getCard } from '../data/cards.ts'
import { ABILITY_KIND, COMMAND_TYPE, PROMPT_KIND, RESOURCE } from '../types/index.ts'
import { apply } from './apply.ts'
import { other, scrapCandidates } from './effects.ts'

function promptCandidates(state: GameState): Command[] {
  const prompt = state.prompt!
  const promptId = prompt.id

  if (prompt.kind === PROMPT_KIND.CHOICE)
    return prompt.options.map((_, index) => ({ type: COMMAND_TYPE.CHOOSE_OPTION, promptId, index }))
  if (prompt.kind === PROMPT_KIND.DISCARD)
    return state.players[prompt.player].hand.map(card => ({ type: COMMAND_TYPE.CHOOSE_CARD, promptId, cardId: card.id }))

  const cards: Command[] = scrapCandidates(state, prompt.player, prompt.zones)
    .map(({ card }) => ({ type: COMMAND_TYPE.CHOOSE_CARD, promptId, cardId: card.id }))
  return prompt.optional ? [...cards, { type: COMMAND_TYPE.SKIP, promptId }] : cards
}

function turnCandidates(state: GameState, player: PlayerId): Command[] {
  const me = state.players[player]
  const opponent = state.players[other(player)]
  const commands: Command[] = []

  for (const card of me.hand)
    commands.push({ type: COMMAND_TYPE.PLAY_CARD, cardId: card.id })

  for (const card of state.tradeRow) {
    if (card)
      commands.push({ type: COMMAND_TYPE.BUY, cardId: card.id })
  }
  commands.push({ type: COMMAND_TYPE.BUY_EXPLORER })

  for (const { card } of me.inPlay) {
    const { abilities } = getCard(card.cardId)
    for (const ability of Object.values(ABILITY_KIND)) {
      if (abilities[ability])
        commands.push({ type: COMMAND_TYPE.ACTIVATE, cardId: card.id, ability })
    }
  }

  for (const { card } of opponent.inPlay)
    commands.push({ type: COMMAND_TYPE.ATTACK_BASE, cardId: card.id })
  // Атака игрока: предлагается весь пул, но apply принимает любое значение от 1 до пула.
  commands.push({ type: COMMAND_TYPE.ATTACK_PLAYER, amount: state.pools[RESOURCE.COMBAT] })
  commands.push({ type: COMMAND_TYPE.END_TURN })
  return commands
}

/**
 * Команды, которые игрок может выполнить прямо сейчас. Кандидаты проверяются самим apply,
 * поэтому список всегда согласован с правилами.
 */
export function legalActions(state: GameState, player: PlayerId): Command[] {
  if (state.winner !== null)
    return []
  const candidates = state.prompt ? promptCandidates(state) : turnCandidates(state, player)
  return candidates.filter(command => apply(state, player, command).ok)
}
