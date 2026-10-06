/**
 * Адрес WebSocket-сервера: VITE_WS_URL, если задан; при разработке - локальный сервер; в собранном приложении -
 * тот же хост, с которого открыта страница (его проксирует nginx, см. apps/client/nginx.conf).
 */
function defaultWsUrl(): string {
  if (import.meta.env.DEV)
    return 'ws://localhost:3001/ws'
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
}

export const appConfig = {
  // Пустая строка (переменная задана, но без значения, как в CI) считается незаданной.
  wsUrl: import.meta.env.VITE_WS_URL || defaultWsUrl(),
}
