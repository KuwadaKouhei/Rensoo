import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestAssociations } from './associations'
import { ApiError } from './errors'

/** fetch を差し替えて任意の Response を返すスタブにする。 */
const stubFetch = (impl: () => Promise<Response>): void => {
  vi.stubGlobal('fetch', vi.fn(impl))
}

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestAssociations', () => {
  it('正常系: 応答を検証して連想語を返す（AC-1）', async () => {
    stubFetch(async () =>
      jsonResponse(200, {
        words: [{ word: '銀河' }, { word: '惑星' }],
        meta: { provider: 'claude', model: 'claude-haiku-4-5' },
      }),
    )
    const result = await requestAssociations({ input: '宇宙', count: 6 })
    expect(result.words.map((w) => w.word)).toEqual(['銀河', '惑星'])
    expect(result.meta?.provider).toBe('claude')
  })

  it('429 はサーバーの日本語 message と retryable=true を持つ ApiError になる（AC-12）', async () => {
    stubFetch(async () =>
      jsonResponse(429, {
        error: {
          code: 'RATE_LIMITED',
          message: 'リクエストが集中しています。しばらくして再試行してください。',
          retryable: true,
        },
      }),
    )
    await expect(requestAssociations({ input: '宇宙', count: 6 })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'RATE_LIMITED',
      retryable: true,
      status: 429,
    })
  })

  it('ネットワーク不通は NETWORK(retryable) の日本語 ApiError になる', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(requestAssociations({ input: '宇宙', count: 6 })).rejects.toMatchObject({
      code: 'NETWORK',
      retryable: true,
      status: 0,
    })
  })

  it('スキーマに合わない 200 応答は INVALID_RESPONSE になる', async () => {
    stubFetch(async () => jsonResponse(200, { items: [] }))
    await expect(requestAssociations({ input: '宇宙', count: 6 })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  })

  it('不正なリクエスト（空入力）は送信前に弾く', async () => {
    stubFetch(async () => jsonResponse(200, { words: [] }))
    await expect(requestAssociations({ input: '', count: 6 })).rejects.toBeInstanceOf(Error)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('エラー本文が壊れていてもステータスからフォールバック日本語メッセージを作る', async () => {
    stubFetch(async () => new Response('<html>500</html>', { status: 500 }))
    const err = await requestAssociations({ input: '宇宙', count: 6 }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('UNKNOWN')
    expect((err as ApiError).retryable).toBe(true)
    expect((err as ApiError).message).toContain('サーバー')
  })
})
