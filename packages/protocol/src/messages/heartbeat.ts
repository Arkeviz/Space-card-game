import * as z from 'zod'

/** Heartbeat useWebSocket: клиент шлёт PING, сервер отвечает PONG. */
export const HEARTBEAT = {
  PING: 'ping',
  PONG: 'pong',
} as const

export const PingSchema = z.literal(HEARTBEAT.PING)
export const PongSchema = z.literal(HEARTBEAT.PONG)

export const isPing = (value: unknown): value is typeof HEARTBEAT.PING => PingSchema.safeParse(value).success
