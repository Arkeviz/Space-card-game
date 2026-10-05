/** Форма слова по числу: plural(1, ['карту', 'карты', 'карт']) -> 'карту', 2 -> 'карты', 5 -> 'карт'. */
export function plural(count: number, forms: readonly [one: string, few: string, many: string]): string {
  const tens = count % 100
  const units = count % 10
  if (tens >= 11 && tens <= 14)
    return forms[2]
  if (units === 1)
    return forms[0]
  return units >= 2 && units <= 4 ? forms[1] : forms[2]
}

/** «1 карту», «2 карты», «5 карт»: винительный падеж с числом. */
export function cardsWord(count: number): string {
  return `${count} ${plural(count, ['карту', 'карты', 'карт'])}`
}
