import type { WebSocket } from 'ws'

/** 1 = WebSocket.OPEN. Не импортируем константу из 'ws', чтобы не тянуть лишний рантайм-объект. */
export const SOCKET_OPEN = 1

/**
 * Сколько байт может ждать отправки в одном сокете. Больше - клиент не читает ответы (или читает слишком медленно):
 * соединение рвётся, иначе очередь росла бы в памяти сервера без предела. Обычный update - единицы килобайт.
 */
export const MAX_BUFFERED_BYTES = 1024 * 1024

/** Отправляет текст, если сокет открыт; переполненный сокет закрывается без ожидания (terminate). */
export function sendText(socket: WebSocket, text: string): void {
  if (socket.readyState !== SOCKET_OPEN)
    return
  if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
    socket.terminate()
    return
  }
  socket.send(text)
}
