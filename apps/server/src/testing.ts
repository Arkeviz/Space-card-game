import type { ServerMessage } from '@space/protocol'
import type { MatchManagerOptions } from './match-manager.ts'
import { SERVER_MESSAGE } from '@space/protocol'
import { MatchManager } from './match-manager.ts'

/** Заглушка WebSocket: не поднимает реальную сеть, просто копит отправленные сообщения. Только для тестов. */
export class FakeSocket {
  readyState = 1
  closed = false
  readonly sent: ServerMessage[] = []
  send(data: string): void {
    this.sent.push(JSON.parse(data))
  }

  close(): void {
    this.closed = true
    this.readyState = 3
  }

  lastOf<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }> {
    const message = [...this.sent].reverse().find(m => m.type === type)
    if (!message)
      throw new Error(`Сообщение типа ${type} не отправлено. Отправлены: ${this.sent.map(m => m.type).join(', ')}`)
    return message as Extract<ServerMessage, { type: T }>
  }

  has(type: ServerMessage['type']): boolean {
    return this.sent.some(m => m.type === type)
  }

  /** Открытый токен переподключения из JOINED: на сервере хранится только его хэш. */
  get token(): string {
    return this.lastOf(SERVER_MESSAGE.JOINED).token
  }
}

type Sock = Parameters<MatchManager['createMatch']>[0]
export type TestSocket = FakeSocket & Sock

export function fakeSocket(): TestSocket {
  return new FakeSocket() as unknown as TestSocket
}

/** Создаёт матч на двоих: игрок 0 создаёт, игрок 1 входит по коду. */
export function setupMatch(options: MatchManagerOptions = { firstPlayer: 0 }) {
  const manager = new MatchManager(options)
  const socket0 = fakeSocket()
  const { room } = manager.createMatch(socket0, 'Алиса')
  const socket1 = fakeSocket()
  manager.joinMatch(socket1, room.code, 'Боб')
  return { manager, room, socket0, socket1 }
}
