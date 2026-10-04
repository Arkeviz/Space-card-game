import type { CardInstance, GameEvent, PlayerId, ScrapZone } from '@space/engine'
import type { Side, TableSide, TableState } from './types'
import { ABILITY_KIND, CARD_KIND, DESTINATION, EVENT_TYPE, getCard, RESOURCE, SCRAP_ZONE } from '@space/engine'
import { SIDE } from './types'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function sideOf(table: TableState, player: PlayerId): Side {
  return player === table.you ? SIDE.SELF : SIDE.OPPONENT
}

function countCards(cards: readonly CardInstance[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const { cardId } of cards)
    counts[cardId] = (counts[cardId] ?? 0) + 1
  // Ключи по алфавиту, как у сервера: тест сверяет стол со снимком через toEqual, а порядок ключей для него неважен,
  // но одинаковый порядок делает отладку по JSON предсказуемой.
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}

/** Карта легла на верх колоды: счётчик растёт, а у себя ещё и состав колоды (порядок не известен никому). */
function putOnDeckTop(side: TableSide, card: CardInstance): void {
  side.deckCount += 1
  if (side.deckContents)
    side.deckContents[card.cardId] = (side.deckContents[card.cardId] ?? 0) + 1
}

function removeCard(list: CardInstance[], cardId: string): void {
  const index = list.findIndex(card => card.id === cardId)
  if (index !== -1)
    list.splice(index, 1)
}

/** Карта ушла из руки: у себя убираем конкретную, у соперника известен только счётчик. */
function takeFromHand(side: TableSide, cardId: string): void {
  removeCard(side.hand, cardId)
  side.handCount = Math.max(0, side.handCount - 1)
}

function removeFromScrapSource(table: TableState, player: PlayerId, card: CardInstance, from: ScrapZone | 'play'): void {
  const side = table[sideOf(table, player)]
  if (from === SCRAP_ZONE.HAND) {
    takeFromHand(side, card.id)
  }
  else if (from === SCRAP_ZONE.DISCARD) {
    removeCard(side.discard, card.id)
  }
  else if (from === SCRAP_ZONE.TRADE_ROW) {
    const slot = table.tradeRow.findIndex(entry => entry?.id === card.id)
    if (slot !== -1)
      table.tradeRow[slot] = null
  }
  else {
    side.inPlay = side.inPlay.filter(entry => entry.card.id !== card.id)
  }
}

/**
 * Применяет одно событие к столу и возвращает новый стол. Те же правила, что у движка, но только то, что
 * видно игроку: после всех событий update'а результат должен совпасть с buildTable(view) (проверяется тестом).
 */
export function reduceEvent(table: TableState, event: GameEvent): TableState {
  const next = clone(table)

  switch (event.type) {
    case EVENT_TYPE.DECK_SHUFFLED: {
      const side = next[sideOf(next, event.player)]
      // Колода была пуста: новая колода - это перемешанный сброс.
      if (side.deckContents)
        side.deckContents = countCards(side.discard)
      side.discard = []
      side.deckCount = event.count
      break
    }

    case EVENT_TYPE.CARDS_DRAWN: {
      const side = next[sideOf(next, event.player)]
      side.deckCount -= event.count
      side.handCount += event.count
      if (event.cards) {
        side.hand.push(...event.cards)
        const contents = side.deckContents
        if (contents) {
          for (const { cardId } of event.cards) {
            const left = (contents[cardId] ?? 0) - 1
            if (left > 0)
              contents[cardId] = left
            else
              delete contents[cardId]
          }
        }
      }
      break
    }

    case EVENT_TYPE.CARD_PLAYED: {
      const side = next[sideOf(next, event.player)]
      takeFromHand(side, event.card.id)
      // Движок помечает базовую способность корабля использованной сразу: она срабатывает при розыгрыше.
      const isShip = getCard(event.card.cardId).kind === CARD_KIND.SHIP
      side.inPlay.push({ card: event.card, used: { [ABILITY_KIND.BASIC]: isShip, [ABILITY_KIND.ALLY]: false } })
      break
    }

    case EVENT_TYPE.CARD_BOUGHT: {
      const side = next[sideOf(next, event.player)]
      if (event.from === 'explorers')
        next.explorersCount -= 1
      else if (event.slot !== null)
        next.tradeRow[event.slot] = null
      if (event.to === DESTINATION.DECK_TOP)
        putOnDeckTop(side, event.card)
      else
        side.discard.push(event.card)
      break
    }

    case EVENT_TYPE.CARD_ACQUIRED: {
      if (event.from === 'explorers')
        next.explorersCount -= 1
      else if (event.slot !== null)
        next.tradeRow[event.slot] = null
      putOnDeckTop(next[sideOf(next, event.player)], event.card)
      break
    }

    case EVENT_TYPE.SHIP_COPIED: {
      const entry = next[sideOf(next, event.player)].inPlay.find(item => item.card.id === event.cardId)
      if (entry)
        entry.copyOf = event.copyOf
      break
    }

    case EVENT_TYPE.TRADE_ROW_REFILLED:
      next.tradeRow[event.slot] = event.card
      next.tradeDeckCount -= 1
      break

    case EVENT_TYPE.ABILITY_ACTIVATED: {
      const entry = next[sideOf(next, event.player)].inPlay.find(item => item.card.id === event.cardId)
      // Утилизация убирает карту со стола раньше, чем приходит это событие: тогда флаг ставить некуда.
      if (entry && event.ability !== ABILITY_KIND.SCRAP)
        entry.used[event.ability] = true
      break
    }

    case EVENT_TYPE.RESOURCE_GAINED:
      if (event.resource === RESOURCE.AUTHORITY)
        next[sideOf(next, event.player)].authority += event.amount
      else
        next.pools[event.resource] += event.amount
      break

    case EVENT_TYPE.RESOURCE_SPENT:
      next.pools[event.resource] -= event.amount
      break

    case EVENT_TYPE.PLAYER_ATTACKED:
      next[sideOf(next, event.target)].authority -= event.amount
      break

    case EVENT_TYPE.BASE_DESTROYED: {
      const side = next[sideOf(next, event.owner)]
      side.inPlay = side.inPlay.filter(entry => entry.card.id !== event.card.id)
      side.discard.push(event.card)
      break
    }

    case EVENT_TYPE.CARD_DISCARDED: {
      const side = next[sideOf(next, event.player)]
      if (event.from === 'hand')
        takeFromHand(side, event.card.id)
      else
        side.inPlay = side.inPlay.filter(entry => entry.card.id !== event.card.id)
      side.discard.push(event.card)
      break
    }

    case EVENT_TYPE.CARD_SCRAPPED:
      removeFromScrapSource(next, event.player, event.card, event.from)
      next.scrapHeap.push(event.card)
      break

    case EVENT_TYPE.PROMPT_OPENED:
      next.prompt = event.prompt
      break

    case EVENT_TYPE.PROMPT_RESOLVED:
      next.prompt = null
      break

    case EVENT_TYPE.TURN_STARTED: {
      next.currentPlayer = event.player
      next.turn = event.turn
      next.pools = { [RESOURCE.TRADE]: 0, [RESOURCE.COMBAT]: 0 }
      for (const entry of next[sideOf(next, event.player)].inPlay)
        entry.used = { [ABILITY_KIND.BASIC]: false, [ABILITY_KIND.ALLY]: false }
      break
    }

    case EVENT_TYPE.GAME_OVER:
      next.winner = event.winner
      break

    case EVENT_TYPE.TURN_ENDED:
      break
  }

  return next
}
