import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { AssociationProviderError } from '@rensoo/shared'
import { handleError, AppError } from './errors'

/** onError に handleError を据えたテスト用アプリ。指定エラーを throw する。 */
const appThrowing = (err: unknown) => {
  const app = new Hono()
  app.get('/boom', () => {
    throw err
  })
  app.onError(handleError)
  return app
}

describe('handleError（全層のエラー写像・AC-12,13）', () => {
  it('AppError は code に応じた status・日本語・retryable を返す', async () => {
    const res = await appThrowing(new AppError('NOT_FOUND')).request('/boom')
    expect(res.status).toBe(404)
    const json = (await res.json()) as {
      error: { code: string; message: string; retryable: boolean }
    }
    expect(json.error.code).toBe('NOT_FOUND')
    expect(json.error.retryable).toBe(false)
    expect(json.error.message.length).toBeGreaterThan(0)
  })

  it('AssociationProviderError(rate_limit) は 429 RATE_LIMITED(retryable)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await appThrowing(new AssociationProviderError('rate', 'rate_limit', true)).request(
      '/boom',
    )
    expect(res.status).toBe(429)
    const json = (await res.json()) as { error: { code: string; retryable: boolean } }
    expect(json.error.code).toBe('RATE_LIMITED')
    expect(json.error.retryable).toBe(true)
  })

  it('未知の例外は 500 INTERNAL（日本語）にフォールバック', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await appThrowing(new Error('unexpected')).request('/boom')
    expect(res.status).toBe(500)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('INTERNAL')
  })

  it('内部情報（cause/スタック/秘密）を応答に含めない（AC-13）', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const secret = 'sk-ant-SECRET-KEY-zzz'
    const res = await appThrowing(
      new AssociationProviderError('unknown', 'unknown', false, {
        cause: new Error(secret),
      }),
    ).request('/boom')
    const text = await res.text()
    expect(text).not.toContain(secret)
    expect(text).not.toContain('Error:')
    expect(text).not.toContain('stack')
    // 詳細はサーバーログには出てよい（ユーザー応答に出さないことが要件）。
    errorLog.mockRestore()
  })
})
