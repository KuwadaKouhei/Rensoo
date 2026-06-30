import { describe, expect, it, vi } from 'vitest'
import { AssociationProviderError } from '@rensoo/shared'
import { withRetry } from './rateLimiter'

// 待機は注入した no-op を使い、テストを高速・決定的にする。
const noSleep = async (): Promise<void> => {}

describe('withRetry', () => {
  it('成功すればそのまま結果を返す（リトライしない）', async () => {
    const fn = vi.fn(async () => 'ok')
    const result = await withRetry(fn, { sleep: noSleep })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('再試行可能エラーは指定回数まで再試行し、成功すれば返す', async () => {
    let calls = 0
    const fn = vi.fn(async () => {
      calls += 1
      if (calls < 3) {
        throw new AssociationProviderError('rate', 'rate_limit', true)
      }
      return 'recovered'
    })
    const result = await withRetry(fn, { retries: 3, sleep: noSleep })
    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('リトライを使い切ったら最後のエラーを再スローする', async () => {
    const fn = vi.fn(async () => {
      throw new AssociationProviderError('rate', 'rate_limit', true)
    })
    await expect(withRetry(fn, { retries: 2, sleep: noSleep })).rejects.toMatchObject({
      kind: 'rate_limit',
    })
    expect(fn).toHaveBeenCalledTimes(3) // 初回 + 2 リトライ
  })

  it('再試行不可エラーは即座に再スローする（リトライしない）', async () => {
    const fn = vi.fn(async () => {
      throw new AssociationProviderError('invalid', 'invalid_response', false)
    })
    await expect(withRetry(fn, { retries: 3, sleep: noSleep })).rejects.toMatchObject({
      kind: 'invalid_response',
    })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('AssociationProviderError 以外は再試行せず即座に再スローする', async () => {
    const fn = vi.fn(async () => {
      throw new Error('boom')
    })
    await expect(withRetry(fn, { retries: 3, sleep: noSleep })).rejects.toThrow('boom')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('バックオフ待機は 2 のべき乗で増える（sleep へ渡る ms を確認）', async () => {
    const delays: number[] = []
    const sleep = async (ms: number): Promise<void> => {
      delays.push(ms)
    }
    const fn = async () => {
      throw new AssociationProviderError('rate', 'rate_limit', true)
    }
    await expect(withRetry(fn, { retries: 2, baseDelayMs: 100, sleep })).rejects.toBeInstanceOf(
      AssociationProviderError,
    )
    expect(delays).toEqual([100, 200])
  })
})
