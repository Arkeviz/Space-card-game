import type { GameEvent } from '@space/engine'
import { EVENT_TYPE } from '@space/engine'

/** События, которые одного типа подряд проигрываются вместе: карты летят пачкой с небольшим сдвигом, а не по одной. */
const BATCHED = new Set<GameEvent['type']>([
  EVENT_TYPE.CARDS_DRAWN,
  EVENT_TYPE.CARD_DISCARDED,
  EVENT_TYPE.RESOURCE_GAINED,
  EVENT_TYPE.RESOURCE_SPENT,
])

export function groupEvents(events: readonly GameEvent[]): GameEvent[][] {
  const groups: GameEvent[][] = []
  for (const event of events) {
    const last = groups.at(-1)
    if (last && BATCHED.has(event.type) && last[0]!.type === event.type)
      last.push(event)
    else
      groups.push([event])
  }
  return groups
}

/** Минимальная длительность шага (мс): события без движения карт всё равно должны успеть быть замеченными. */
export function beatFor(group: readonly GameEvent[]): number {
  switch (group[0]!.type) {
    case EVENT_TYPE.RESOURCE_GAINED:
    case EVENT_TYPE.RESOURCE_SPENT:
      return 220
    case EVENT_TYPE.PLAYER_ATTACKED:
      return 600
    case EVENT_TYPE.BASE_DESTROYED:
      return 500
    case EVENT_TYPE.DECK_SHUFFLED:
      return 900
    case EVENT_TYPE.TURN_STARTED:
      return 700
    case EVENT_TYPE.GAME_OVER:
      return 400
    case EVENT_TYPE.CARD_PLAYED:
    case EVENT_TYPE.CARD_BOUGHT:
    case EVENT_TYPE.CARD_SCRAPPED:
    case EVENT_TYPE.ABILITY_ACTIVATED:
      return 250
    default:
      return 0
  }
}
