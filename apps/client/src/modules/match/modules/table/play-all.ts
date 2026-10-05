import type { CardInstance, Effect } from '@space/engine'
import { ABILITY_KIND, CARD_KIND, EFFECT_TYPE, getCard } from '@space/engine'

/** Эффекты, после которых игре нужен выбор игрока (утилизация, вариант и т. п.). Сброс у соперника сюда не входит: он откладывается на начало хода соперника. */
const PROMPT_EFFECTS = new Set<Effect['type']>([
  EFFECT_TYPE.SCRAP,
  EFFECT_TYPE.CHOICE,
  EFFECT_TYPE.DESTROY_BASE,
  EFFECT_TYPE.ACQUIRE_SHIP,
  EFFECT_TYPE.DISCARD_DRAW,
  // Копировать можно только корабль, уже сыгранный в этот ход, поэтому такая карта идёт после остальных.
  EFFECT_TYPE.COPY_SHIP,
])

/**
 * Откроет ли розыгрыш карты запрос с выбором. Срабатывает базовая способность только у кораблей (база
 * активируется отдельной командой), поэтому у баз запроса при розыгрыше не бывает.
 */
export function cardOpensPrompt(cardId: string): boolean {
  const card = getCard(cardId)
  if (card.kind !== CARD_KIND.SHIP)
    return false
  return (card.abilities[ABILITY_KIND.BASIC] ?? []).some(effect => PROMPT_EFFECTS.has(effect.type))
}

/**
 * Какую карту руки разыграть следующей при «разыграть все»: сначала те, что не требуют выбора, в порядке руки;
 * карты с выбором - в самом конце, потому что их запрос останавливает цепочку. Null - играть больше нечего.
 */
export function nextCardToPlay(hand: readonly CardInstance[], playable: ReadonlySet<string>): string | null {
  const candidates = hand.filter(card => playable.has(card.id))
  const simple = candidates.find(card => !cardOpensPrompt(card.cardId))
  return (simple ?? candidates[0])?.id ?? null
}
