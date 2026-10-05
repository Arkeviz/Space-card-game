import type { GameEvent, PlayerId } from '@space/engine'
import type { TableState } from '../../table'
import type { Pose } from './layout'
import { DESTINATION, EVENT_TYPE } from '@space/engine'
import { SIDE, sideOf } from '../../table'
import {
  explorersPose,
  layoutOf,
  opponentDeckPose,
  opponentDiscardPose,
  opponentHandOrigin,
  selfDeckPose,
  selfDiscardPose,
  tradeDeckPose,
} from './layout'
import { NODE_KEY } from './nodes'

/** Откуда появляется новая карта: поза старта и лежит ли она рубашкой вверх (тогда по пути переворачивается). */
export interface SpawnHint {
  from: Pose
  faceDown: boolean
}

/**
 * Подсказки слою карт для одного шага анимации. По умолчанию новая карта проявляется на месте, исчезающая
 * растворяется на месте, а уже существующая просто плавно едет в новую позицию - всё остальное задаёт этот объект.
 */
export interface Motion {
  spawn: Map<string, SpawnHint>
  /** Куда улетает карта, пропадающая со стола (например, сброс, перемешанный в колоду). */
  exit: Map<string, Pose>
  /** Задержка старта (в секундах) для карт, летящих «пачкой»: раздача по одной, а не всей рукой разом. */
  delay: Map<string, number>
}

export function emptyMotion(): Motion {
  return { spawn: new Map(), exit: new Map(), delay: new Map() }
}

/** Шаг между картами одной пачки, секунды. */
const STAGGER = 0.12

function deckPose(table: TableState, player: PlayerId): Pose {
  return sideOf(table, player) === SIDE.SELF ? selfDeckPose() : opponentDeckPose()
}

/**
 * Подсказки для группы событий, которые проигрываются вместе (before - стол до группы).
 * Чистая функция: только геометрия и ключи узлов, без DOM и GSAP.
 */
export function motionFor(events: readonly GameEvent[], before: TableState): Motion {
  const motion = emptyMotion()
  let drawn = 0
  let discarded = 0
  // Сколько карт соперника уже «выехало» из руки в этой группе: для ключей рубашек и задержки.
  let opponentHandDrawn = 0

  for (const event of events) {
    switch (event.type) {
      case EVENT_TYPE.CARDS_DRAWN: {
        const mine = sideOf(before, event.player) === SIDE.SELF
        if (mine) {
          for (const card of event.cards ?? []) {
            motion.spawn.set(card.id, { from: selfDeckPose(), faceDown: true })
            motion.delay.set(card.id, drawn * STAGGER)
            drawn += 1
          }
        }
        else {
          for (let i = 0; i < event.count; i++) {
            const key = NODE_KEY.opponentHand(before.opponent.handCount + opponentHandDrawn)
            motion.spawn.set(key, { from: opponentDeckPose(), faceDown: true })
            motion.delay.set(key, drawn * STAGGER)
            opponentHandDrawn += 1
            drawn += 1
          }
        }
        break
      }

      case EVENT_TYPE.CARD_PLAYED:
        if (sideOf(before, event.player) === SIDE.OPPONENT)
          motion.spawn.set(event.card.id, { from: opponentHandOrigin(), faceDown: true })
        break

      case EVENT_TYPE.CARD_DISCARDED:
        if (sideOf(before, event.player) === SIDE.OPPONENT && event.from === 'hand')
          motion.spawn.set(event.card.id, { from: opponentHandOrigin(), faceDown: true })
        motion.delay.set(event.card.id, discarded * (STAGGER / 2))
        discarded += 1
        break

      case EVENT_TYPE.CARD_SCRAPPED: {
        const mine = sideOf(before, event.player) === SIDE.SELF
        if (!mine && event.from === 'hand')
          motion.spawn.set(event.card.id, { from: opponentHandOrigin(), faceDown: true })
        // Карта из глубины сброса на столе не нарисована: она «достаётся» из стопки и распадается на месте.
        else if (event.from === 'discard')
          motion.spawn.set(event.card.id, { from: mine ? selfDiscardPose() : opponentDiscardPose(), faceDown: false })
        break
      }

      case EVENT_TYPE.CARD_BOUGHT:
        if (event.from === 'explorers')
          motion.spawn.set(event.card.id, { from: explorersPose(layoutOf(before).trade), faceDown: false })
        // Корабль на верх колоды: карта улетает в колоду и пропадает, а не ложится на сброс.
        if (event.to === DESTINATION.DECK_TOP)
          motion.exit.set(event.card.id, { ...deckPose(before, event.player), opacity: 0 })
        break

      case EVENT_TYPE.CARD_ACQUIRED:
        motion.exit.set(event.card.id, { ...deckPose(before, event.player), opacity: 0 })
        break

      case EVENT_TYPE.TRADE_ROW_REFILLED:
        motion.spawn.set(event.card.id, { from: tradeDeckPose(layoutOf(before).trade), faceDown: true })
        motion.delay.set(event.card.id, 0.2)
        break

      case EVENT_TYPE.DECK_SHUFFLED: {
        // Сброс уходит в колоду: карты, которые были нарисованы на стопке, улетают на неё и пропадают.
        const side = sideOf(before, event.player)
        const target = deckPose(before, event.player)
        for (const card of before[side].discard.slice(-2))
          motion.exit.set(card.id, { ...target, opacity: 0 })
        break
      }

      default:
        break
    }
  }

  return motion
}
