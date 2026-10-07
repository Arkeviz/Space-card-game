import type { Card, GameEvent, ValueOf } from '@space/engine'
import type { TableState } from '../../table'
import type { FxItem, FxTarget } from './fx'
import { ABILITY_KIND, CARD_KIND, DESTINATION, EVENT_TYPE, getCard, PROMPT_KIND, RESOURCE } from '@space/engine'
import { cardsWord } from '@/common/utilities/plural'
import { cardName, describeEffectShort, KIND_LABEL } from '@/modules/cards'
import { SIDE, sideOf } from '../../table'
import { FX_TARGET, FX_TONE } from './fx'

export const LOG_KIND = {
  HEAD: 'head',
  ITEM: 'item',
} as const
export type LogKind = ValueOf<typeof LOG_KIND>

export interface LogEntry {
  id: number
  kind: LogKind
  mine: boolean
  text: string
}

export interface StepOutput {
  entries: Omit<LogEntry, 'id'>[]
  fx: Omit<FxItem, 'id'>[]
}

function basicSummary(card: Card): string {
  return (card.abilities[ABILITY_KIND.BASIC] ?? []).map(describeEffectShort).join(', ')
}

function abilitySummary(card: Card, ability: typeof ABILITY_KIND.ALLY | typeof ABILITY_KIND.SCRAP | typeof ABILITY_KIND.BASIC): string {
  return (card.abilities[ability] ?? []).map(describeEffectShort).join(', ')
}

function signed(amount: number): string {
  return amount > 0 ? `+${amount}` : `${amount}`
}

/**
 * Запись в журнал и всплывающие числа для группы событий. before - стол до группы (нужен, например, чтобы
 * понять, что сброс карты был ответом на prompt, а не концом хода), after - после.
 */
export function describeStep(group: readonly GameEvent[], before: TableState, after: TableState): StepOutput {
  const out: StepOutput = { entries: [], fx: [] }
  const item = (mine: boolean, text: string): void => {
    out.entries.push({ kind: LOG_KIND.ITEM, mine, text })
  }
  const fx = (target: FxTarget, amount: number): void => {
    out.fx.push({ target, text: signed(amount), tone: amount > 0 ? FX_TONE.GAIN : FX_TONE.LOSS })
  }
  const isMine = (player: 0 | 1): boolean => sideOf(before, player) === SIDE.SELF

  for (const event of group) {
    switch (event.type) {
      case EVENT_TYPE.TURN_STARTED: {
        const mine = isMine(event.player)
        out.entries.push({ kind: LOG_KIND.HEAD, mine, text: `ХОД ${event.turn} · ${mine ? 'ВЫ' : 'СОПЕРНИК'}` })
        break
      }

      case EVENT_TYPE.CARD_PLAYED: {
        const card = getCard(event.card.cardId)
        const name = cardName(card.id)
        if (card.kind === CARD_KIND.SHIP) {
          const summary = basicSummary(card)
          item(isMine(event.player), `Разыграна «${name}»${summary ? `: ${summary}` : ''}`)
        }
        else {
          item(isMine(event.player), `Разыграна «${name}» - ${KIND_LABEL[card.kind].toLowerCase()}, прочность ${card.defense ?? 0}`)
        }
        break
      }

      case EVENT_TYPE.ABILITY_ACTIVATED: {
        const entry = [...before.self.inPlay, ...before.opponent.inPlay].find(played => played.card.id === event.cardId)
        const instanceCardId = entry?.card.cardId
        // Утилизированной карты уже нет на столе: берём её из утиля после шага.
        const scrapped = after.scrapHeap.find(card => card.id === event.cardId)
        const cardId = instanceCardId ?? scrapped?.cardId
        if (!cardId)
          break
        const card = getCard(cardId)
        const name = cardName(cardId)
        const summary = abilitySummary(card, event.ability)
        const mine = isMine(event.player)
        if (event.ability === ABILITY_KIND.ALLY)
          item(mine, `Союзник «${name}»: ${summary}`)
        else if (event.ability === ABILITY_KIND.SCRAP)
          item(mine, `«${name}» утилизирована: ${summary}`)
        else
          item(mine, `«${name}»: ${summary}`)
        break
      }

      case EVENT_TYPE.CARD_BOUGHT:
        item(isMine(event.player), `Покупка: «${cardName(event.card.cardId)}» за ${getCard(event.card.cardId).cost}${event.to === DESTINATION.DECK_TOP ? ', на верх колоды' : ''}`)
        break

      case EVENT_TYPE.CARD_ACQUIRED:
        item(isMine(event.player), `Получен бесплатно: «${cardName(event.card.cardId)}», на верх колоды`)
        break

      case EVENT_TYPE.DISCARD_QUEUED:
        // Сброс откладывается на начало хода того, кому он адресован: об этом нужно сообщить сразу.
        item(!isMine(event.player), isMine(event.player)
          ? `Вы сбросите ${cardsWord(event.amount)} в начале своего хода`
          : `Соперник сбросит ${cardsWord(event.amount)} в начале своего хода`)
        break

      case EVENT_TYPE.SHIP_COPIED: {
        const own = [...before.self.inPlay, ...before.opponent.inPlay].find(entry => entry.card.id === event.cardId)
        item(isMine(event.player), `«${cardName(own?.card.cardId ?? event.cardId)}» копирует «${cardName(event.copyOf)}»`)
        break
      }

      case EVENT_TYPE.RESOURCE_GAINED:
        if (event.resource === RESOURCE.AUTHORITY)
          fx(isMine(event.player) ? FX_TARGET.SELF_AUTHORITY : FX_TARGET.OPPONENT_AUTHORITY, event.amount)
        else
          fx(event.resource === RESOURCE.TRADE ? FX_TARGET.TRADE : FX_TARGET.COMBAT, event.amount)
        break

      case EVENT_TYPE.RESOURCE_SPENT:
        fx(event.resource === RESOURCE.TRADE ? FX_TARGET.TRADE : FX_TARGET.COMBAT, -event.amount)
        break

      case EVENT_TYPE.PLAYER_ATTACKED: {
        const targetMine = isMine(event.target)
        item(!targetMine, targetMine ? `Атака по вам: -${event.amount} авторитета` : `Атака по сопернику: -${event.amount} авторитета`)
        fx(targetMine ? FX_TARGET.SELF_AUTHORITY : FX_TARGET.OPPONENT_AUTHORITY, -event.amount)
        break
      }

      case EVENT_TYPE.BASE_DESTROYED: {
        const card = getCard(event.card.cardId)
        const kind = card.kind === CARD_KIND.OUTPOST ? 'аванпост' : 'база'
        item(!isMine(event.owner), `Уничтожена ${kind} «${cardName(card.id)}»`)
        break
      }

      case EVENT_TYPE.CARD_DISCARDED:
        // Сброс по требованию карты соперника - событие игры; сброс руки в конце хода журнал не засоряет.
        if (event.from === 'hand' && before.prompt?.kind === PROMPT_KIND.DISCARD)
          item(isMine(event.player), `Сброшена «${cardName(event.card.cardId)}»`)
        break

      case EVENT_TYPE.CARD_SCRAPPED:
        if (event.from !== 'play')
          item(isMine(event.player), `Утилизирована «${cardName(event.card.cardId)}»`)
        break

      case EVENT_TYPE.DECK_SHUFFLED:
        item(isMine(event.player), isMine(event.player) ? 'Ваш сброс перемешан в колоду' : 'Соперник перемешал сброс в колоду')
        break

      case EVENT_TYPE.PROMPT_OPENED:
        // Обязательный сброс по требованию соперника; свой необязательный сброс (Recycling Station) журнал не засоряет.
        if (event.prompt.kind === PROMPT_KIND.DISCARD && !event.prompt.optional)
          item(!isMine(event.prompt.player), isMine(event.prompt.player) ? `Вы должны сбросить ${cardsWord(event.prompt.remaining ?? 1)}` : 'Соперник выбирает карту для сброса')
        break

      case EVENT_TYPE.GAME_OVER:
        item(true, isMine(event.winner) ? 'Партия окончена: вы победили' : 'Партия окончена: победил соперник')
        break

      default:
        break
    }
  }
  return out
}
