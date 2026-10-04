import type { GameEvent } from '@space/engine'
import type { TableState } from '../../table'
import { EVENT_TYPE } from '@space/engine'
import { SIDE } from '../../table'

/** Начало партии: на столе ещё ничего не сыграно, и карты в руках только что розданы. */
export function isFreshGame(table: TableState): boolean {
  return table.turn <= 1
    && table.winner === null
    && table.self.discard.length === 0
    && table.opponent.discard.length === 0
    && table.self.inPlay.length === 0
    && table.opponent.inPlay.length === 0
    && table.scrapHeap.length === 0
}

/** Стол до раздачи: те же карты, но руки пусты, а колоды полные. */
export function introStartTable(table: TableState): TableState {
  const start = JSON.parse(JSON.stringify(table)) as TableState
  for (const side of [SIDE.SELF, SIDE.OPPONENT]) {
    start[side].deckCount += start[side].handCount
    // Розданные карты возвращаются в состав колоды (у соперника состава нет).
    const contents = start[side].deckContents
    if (contents) {
      for (const { cardId } of start[side].hand)
        contents[cardId] = (contents[cardId] ?? 0) + 1
    }
    start[side].hand = []
    start[side].handCount = 0
  }
  return start
}

/** События раздачи начальных рук: играются теми же обработчиками, что и взятие карт в обычном ходу. */
export function introEvents(table: TableState): GameEvent[] {
  const opponent = table.you === 0 ? 1 : 0
  return [
    { type: EVENT_TYPE.CARDS_DRAWN, player: table.you, count: table.self.handCount, cards: table.self.hand },
    { type: EVENT_TYPE.CARDS_DRAWN, player: opponent, count: table.opponent.handCount },
  ]
}
