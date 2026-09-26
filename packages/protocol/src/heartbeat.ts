import * as v from 'valibot'

/** Heartbeat useWebSocket: клиент шлёт `ping`, сервер отвечает `pong`. */
export const PingSchema = v.literal('ping')
export const PongSchema = v.literal('pong')

export const isPing = (value: unknown): value is 'ping' => v.is(PingSchema, value)
