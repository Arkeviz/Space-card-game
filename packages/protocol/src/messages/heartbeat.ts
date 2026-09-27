import * as v from 'valibot'

/** Heartbeat useWebSocket: клиент шлёт PING, сервер отвечает PONG. */
export const HEARTBEAT = {
  PING: 'ping',
  PONG: 'pong',
} as const

export const PingSchema = v.literal(HEARTBEAT.PING)
export const PongSchema = v.literal(HEARTBEAT.PONG)

export const isPing = (value: unknown): value is typeof HEARTBEAT.PING => v.is(PingSchema, value)
