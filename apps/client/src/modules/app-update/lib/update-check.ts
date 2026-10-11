/** Файл с идентификатором сборки: кладётся в корень сайта при сборке (vite.config.ts). */
export const VERSION_FILE = 'version.json'

/**
 * Идентификатор сборки, которая сейчас лежит на сервере, или null, если узнать не удалось (нет сети, нет файла,
 * вместо него отдалась index.html). Ошибки не пробрасываются: проверка фоновая, следующая попытка будет позже.
 */
export async function fetchServerBuildId(baseUrl: string, doFetch: typeof fetch = fetch): Promise<string | null> {
  try {
    // Параметр и no-store: обойти кэш браузера и промежуточных прокси (GitHub Pages кэширует файлы).
    const response = await doFetch(`${baseUrl}${VERSION_FILE}?t=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok)
      return null
    const data: unknown = await response.json()
    if (typeof data === 'object' && data !== null && 'buildId' in data && typeof data.buildId === 'string')
      return data.buildId
    return null
  }
  catch {
    return null
  }
}

/** Вышла ли новая версия: на сервере другая сборка, чем та, что запущена. Неизвестный ответ новой версией не считается. */
export function isNewBuild(serverBuildId: string | null, currentBuildId: string): boolean {
  return serverBuildId !== null && serverBuildId !== currentBuildId
}
