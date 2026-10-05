import type { AbilityKind, Command } from '@space/engine'
import { COMMAND_TYPE } from '@space/engine'

/** Список legalActions от сервера в виде, удобном для отрисовки: «можно ли сыграть эту карту» без обхода массива. */
export interface LegalIndex {
  playable: Set<string>
  buyable: Set<string>
  canBuyExplorer: boolean
  /** cardId на столе -> способности, которые можно активировать (включая утилизацию). */
  activations: Map<string, Set<AbilityKind>>
  attackableBases: Set<string>
  /** Сколько можно нанести игроку (весь пул атаки); 0, если атаковать игрока нельзя. */
  attackPlayerAmount: number
  canEndTurn: boolean
  /** Ответы на открытый prompt. */
  promptOptions: Set<number>
  promptCards: Set<string>
  canSkip: boolean
  promptId: number | null
}

export function indexLegalActions(actions: readonly Command[]): LegalIndex {
  const index: LegalIndex = {
    playable: new Set(),
    buyable: new Set(),
    canBuyExplorer: false,
    activations: new Map(),
    attackableBases: new Set(),
    attackPlayerAmount: 0,
    canEndTurn: false,
    promptOptions: new Set(),
    promptCards: new Set(),
    canSkip: false,
    promptId: null,
  }

  for (const action of actions) {
    switch (action.type) {
      case COMMAND_TYPE.PLAY_CARD:
        index.playable.add(action.cardId)
        break
      case COMMAND_TYPE.BUY:
        index.buyable.add(action.cardId)
        break
      case COMMAND_TYPE.BUY_EXPLORER:
        index.canBuyExplorer = true
        break
      case COMMAND_TYPE.ACTIVATE: {
        const abilities = index.activations.get(action.cardId) ?? new Set<AbilityKind>()
        abilities.add(action.ability)
        index.activations.set(action.cardId, abilities)
        break
      }
      case COMMAND_TYPE.ATTACK_BASE:
        index.attackableBases.add(action.cardId)
        break
      case COMMAND_TYPE.ATTACK_PLAYER:
        index.attackPlayerAmount = action.amount
        break
      case COMMAND_TYPE.END_TURN:
        index.canEndTurn = true
        break
      case COMMAND_TYPE.CHOOSE_OPTION:
        index.promptOptions.add(action.index)
        index.promptId = action.promptId
        break
      case COMMAND_TYPE.CHOOSE_CARD:
        index.promptCards.add(action.cardId)
        index.promptId = action.promptId
        break
      case COMMAND_TYPE.CHOOSE_CARDS:
        break
      case COMMAND_TYPE.SKIP:
        index.canSkip = true
        index.promptId = action.promptId
        break
      case COMMAND_TYPE.CONCEDE:
        break
    }
  }
  return index
}
