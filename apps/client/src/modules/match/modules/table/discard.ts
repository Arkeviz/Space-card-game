import type { TableState } from './types'
import { PROMPT_KIND } from '@space/engine'

/**
 * Сколько карт из руки нужно (обязательный сброс) или можно (необязательный) сбросить по открытому запросу.
 * Не больше, чем карт в руке; 1, если запроса на сброс у вас нет.
 */
export function discardLimit(table: TableState): number {
  const { prompt } = table
  if (!prompt || prompt.kind !== PROMPT_KIND.DISCARD || prompt.player !== table.you)
    return 1
  return Math.max(1, Math.min(prompt.remaining ?? 1, table.self.hand.length))
}
