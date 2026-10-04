import type { LegalIndex, TableState } from '../../table'
import type { IconName } from '@/common/ui/icons'
import { CARD_KIND, getCard, PROMPT_KIND } from '@space/engine'
import { ICON } from '@/common/ui/icons'
import { cardName } from '@/modules/cards'
import { SIDE } from '../../table'

export interface TurnInfo {
  mine: boolean
  title: string
  sub: string | null
}

export function turnInfo(table: TableState): TurnInfo {
  const mine = table.currentPlayer === table.you
  const prompt = table.prompt
  const waitingForMe = prompt !== null && prompt.player === table.you
  if (mine) {
    return {
      mine,
      title: 'ВАШ ХОД',
      sub: prompt && !waitingForMe ? 'Соперник выбирает карту для сброса' : null,
    }
  }
  return {
    mine,
    title: 'ХОД СОПЕРНИКА',
    sub: waitingForMe
      ? (prompt.kind === PROMPT_KIND.DISCARD ? 'Соперник ждёт, пока вы сбросите карту' : 'Соперник ждёт вашего выбора')
      : 'Соперник разыгрывает карты',
  }
}

export interface Hint {
  icon: IconName
  /** Цвет иконки (CSS). */
  color: string
  text: string
}

function outpostName(table: TableState, side: typeof SIDE.SELF | typeof SIDE.OPPONENT): string | null {
  const entry = table[side].inPlay.find(item => getCard(item.card.cardId).kind === CARD_KIND.OUTPOST)
  return entry ? cardName(entry.card.cardId) : null
}

/** Подсказка под пулами: что сейчас мешает атаковать или как это сделать. */
export function hintFor(table: TableState, legal: LegalIndex): Hint {
  const mine = table.currentPlayer === table.you
  if (mine) {
    const outpost = outpostName(table, SIDE.OPPONENT)
    if (outpost)
      return { icon: ICON.LOCK, color: 'var(--c-text-quiet)', text: `Аванпост «${outpost}» прикрывает соперника и его базы: сначала атакуйте его` }
    if (legal.attackPlayerAmount > 0)
      return { icon: ICON.COMBAT, color: 'var(--c-combat)', text: `Нажмите на панель соперника, чтобы атаковать: ${legal.attackPlayerAmount}` }
    return { icon: ICON.INFO, color: 'var(--c-muted)', text: 'Разыгрывайте карты из руки и покупайте новые на рынке за торговлю' }
  }
  const own = outpostName(table, SIDE.SELF)
  if (own)
    return { icon: ICON.LOCK, color: 'var(--c-text-quiet)', text: `Ваш аванпост «${own}» прикрывает вас и ваши базы` }
  return { icon: ICON.COMBAT, color: 'var(--c-combat)', text: 'У вас нет аванпостов: соперник может атаковать вас или ваши базы' }
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
