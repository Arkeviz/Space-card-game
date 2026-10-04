import type { ValueOf } from '@space/engine'

/** Стопки, содержимое которых можно посмотреть кнопкой на столе. У колоды в окне только состав, без порядка карт. */
export const PILE_ID = {
  SELF_DECK: 'self-deck',
  SELF_DISCARD: 'self-discard',
  OPPONENT_DISCARD: 'opponent-discard',
  SCRAP_HEAP: 'scrap-heap',
} as const
export type PileId = ValueOf<typeof PILE_ID>
