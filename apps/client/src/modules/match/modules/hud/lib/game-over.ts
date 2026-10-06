import type { EndReason } from '@space/protocol'
import { END_REASON } from '@space/protocol'

/** Реванш после конца партии: кто предложил и возможен ли он (соперник на месте). */
export interface RematchStatus {
  you: boolean
  opponent: boolean
  available: boolean
}

const REASON_TEXT: Record<EndReason, { win: string, lose: string }> = {
  [END_REASON.AUTHORITY]: { win: 'Авторитет соперника обнулён.', lose: 'Ваш авторитет обнулён.' },
  [END_REASON.CONCEDE]: { win: 'Соперник сдался.', lose: 'Вы сдались.' },
  [END_REASON.DISCONNECT]: { win: 'Соперник не вернулся после разрыва связи.', lose: 'Вы не вернулись после разрыва связи.' },
  [END_REASON.IDLE]: { win: 'Соперник долго не делал ходов: ему засчитана сдача.', lose: 'Вы долго не делали ходов: вам засчитана сдача.' },
}

/** Пояснение к результату. null (причина неизвестна, например у партии из старой версии сервера) - нейтральный текст. */
export function resultReason(win: boolean, reason: EndReason | null): string {
  if (!reason)
    return 'Партия окончена.'
  return REASON_TEXT[reason][win ? 'win' : 'lose']
}

export interface RematchView {
  label: string
  /** Кнопку нельзя нажать: реванш невозможен или предложение уже отправлено. */
  disabled: boolean
  /** Пояснение под кнопкой; null - нечего сказать. */
  note: string | null
}

/** Что показать на кнопке реванша. */
export function rematchView(status: RematchStatus): RematchView {
  if (!status.available)
    return { label: 'Реванш', disabled: true, note: 'Соперник покинул матч.' }
  if (status.you && status.opponent)
    return { label: 'Начинаем…', disabled: true, note: null }
  if (status.you)
    return { label: 'Ждём соперника…', disabled: true, note: 'Предложение отправлено.' }
  if (status.opponent)
    return { label: 'Принять реванш', disabled: false, note: 'Соперник предлагает реванш.' }
  return { label: 'Реванш', disabled: false, note: null }
}
