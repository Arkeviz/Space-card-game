import { describe, expect, it, vi } from 'vitest'
import { fetchServerBuildId, isNewBuild } from './update-check'

function fakeFetch(response: Partial<Response> | Error): typeof fetch {
  return vi.fn(async () => {
    if (response instanceof Error)
      throw response
    return response as Response
  }) as unknown as typeof fetch
}

describe('fetchServerBuildId', () => {
  it('читает buildId из version.json и обходит кэш', async () => {
    const doFetch = fakeFetch({ ok: true, json: async () => ({ buildId: 'abc' }) })
    expect(await fetchServerBuildId('/game/', doFetch)).toBe('abc')
    const [url, init] = vi.mocked(doFetch).mock.calls[0]!
    expect(String(url)).toMatch(/^\/game\/version\.json\?t=\d+$/)
    expect(init).toEqual({ cache: 'no-store' })
  })

  it('возвращает null при ошибке сети, плохом статусе и неожиданном теле', async () => {
    expect(await fetchServerBuildId('/', fakeFetch(new Error('offline')))).toBeNull()
    expect(await fetchServerBuildId('/', fakeFetch({ ok: false }))).toBeNull()
    // Сервер отдал index.html вместо JSON.
    const html = fakeFetch({ ok: true, json: async () => Promise.reject(new SyntaxError('html')) })
    expect(await fetchServerBuildId('/', html)).toBeNull()
    expect(await fetchServerBuildId('/', fakeFetch({ ok: true, json: async () => ({ buildId: 5 }) }))).toBeNull()
    expect(await fetchServerBuildId('/', fakeFetch({ ok: true, json: async () => null }))).toBeNull()
  })
})

describe('isNewBuild', () => {
  it('новая версия - только если сервер назвал другую сборку', () => {
    expect(isNewBuild('b', 'a')).toBe(true)
    expect(isNewBuild('a', 'a')).toBe(false)
    expect(isNewBuild(null, 'a')).toBe(false)
  })
})
