import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from './app.ts'

describe('ws heartbeat', () => {
  const app = buildApp()

  afterEach(async () => {
    await app.close()
  })

  it('отвечает pong на ping', async () => {
    await app.ready()
    const socket = await app.injectWS('/ws')
    const reply = new Promise<string>((resolve) => {
      socket.once('message', data => resolve(data.toString()))
    })
    socket.send('ping')
    expect(await reply).toBe('pong')
    socket.terminate()
  })
})
