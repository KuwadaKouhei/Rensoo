import { describe, expect, it } from 'vitest'
import {
  AssociationProviderError,
  type AssociateResult,
  type AssociationProvider,
} from '@rensoo/shared'
import { createApp } from '../app'

/** 固定の連想結果を返すスタブ Provider。 */
const stubProvider = (result: AssociateResult): AssociationProvider => ({
  associate: async () => result,
})

/** 指定エラーを throw するスタブ Provider。 */
const failingProvider = (err: unknown): AssociationProvider => ({
  associate: async () => {
    throw err
  },
})

const post = (app: ReturnType<typeof createApp>, body: unknown) =>
  app.request('/api/associations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/associations', () => {
  it('正常系: 連想語と meta を返す（AC-1）', async () => {
    const app = createApp({
      associationProvider: stubProvider({
        words: [{ word: '銀河' }, { word: '惑星' }],
        meta: { provider: 'claude', model: 'claude-haiku-4-5' },
      }),
    })

    const res = await post(app, { input: '宇宙', count: 6 })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { words: { word: string }[]; meta: unknown }
    expect(json.words.map((w) => w.word)).toEqual(['銀河', '惑星'])
    expect(json.meta).toEqual({ provider: 'claude', model: 'claude-haiku-4-5' })
  })

  it('normalizeAssociations が適用される（入力語除去・重複除去・件数トリム / AC-2）', async () => {
    const app = createApp({
      associationProvider: stubProvider({
        words: [
          { word: '宇宙' },
          { word: '星' },
          { word: '星' },
          { word: '銀河' },
          { word: '彗星' },
          { word: '惑星' },
        ],
        meta: { provider: 'claude' },
      }),
    })

    const res = await post(app, { input: '宇宙', count: 3 })
    expect(res.status).toBe(200)
    const json = (await res.json()) as { words: { word: string }[] }
    // 入力語「宇宙」除去・重複「星」除去 → ['星','銀河','彗星','惑星'] を count=3 にトリム
    expect(json.words.map((w) => w.word)).toEqual(['星', '銀河', '彗星'])
  })

  it('空入力は 400 VALIDATION（NFR-7）', async () => {
    const app = createApp({ associationProvider: stubProvider({ words: [], meta: {} }) })
    const res = await post(app, { input: '' })
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('VALIDATION')
  })

  it('件数レンジ外は 400 VALIDATION', async () => {
    const app = createApp({ associationProvider: stubProvider({ words: [], meta: {} }) })
    const res = await post(app, { input: '宇宙', count: 99 })
    expect(res.status).toBe(400)
  })

  it('レート制限は 429 RATE_LIMITED(retryable)（AC-12）', async () => {
    const app = createApp({
      associationProvider: failingProvider(
        new AssociationProviderError('rate', 'rate_limit', true),
      ),
    })
    const res = await post(app, { input: '宇宙', count: 6 })
    expect(res.status).toBe(429)
    const json = (await res.json()) as { error: { code: string; retryable: boolean } }
    expect(json.error.code).toBe('RATE_LIMITED')
    expect(json.error.retryable).toBe(true)
  })

  it('上流 LLM エラーは 502 UPSTREAM_LLM', async () => {
    const app = createApp({
      associationProvider: failingProvider(new AssociationProviderError('x', 'upstream', true)),
    })
    const res = await post(app, { input: '宇宙', count: 6 })
    expect(res.status).toBe(502)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('UPSTREAM_LLM')
  })

  it('エラー応答は内部情報を含まない（error.code/message/retryable のみ・AC-13）', async () => {
    const app = createApp({
      associationProvider: failingProvider(
        new AssociationProviderError('secret detail', 'unknown', false, { cause: new Error('x') }),
      ),
    })
    const res = await post(app, { input: '宇宙', count: 6 })
    const json = (await res.json()) as { error: Record<string, unknown> }
    expect(Object.keys(json)).toEqual(['error'])
    expect(Object.keys(json.error).sort()).toEqual(['code', 'message', 'retryable'])
    expect(JSON.stringify(json)).not.toContain('secret detail')
  })
})

describe('GET /api/health', () => {
  it('200 で status:ok を返す', async () => {
    const app = createApp({ associationProvider: stubProvider({ words: [], meta: {} }) })
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})
