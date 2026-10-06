/**
 * Случайный идентификатор (id команды). crypto.randomUUID есть только в защищённом контексте (HTTPS или localhost),
 * а игру открывают и по обычному http://адрес:порт, где его нет: тогда id собирается из crypto.getRandomValues,
 * который доступен всегда.
 */
export function randomId(): string {
  if (typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()
  return [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
