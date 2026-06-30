// レート制御（DESIGN §6.4）。上流 LLM の 429／タイムアウト等の「再試行可能」失敗に対し、
// 指数バックオフ＋リトライ上限で対処する。リトライを使い切ったら最後のエラーを再スローする
//（握りつぶさない・CODING_PHILOSOPHY）。
//
// MVP の BFS はノードを逐次処理する（実効並列度 1＝最も保守的なレート制御）。
// 並列度を上げるチューニングは将来の最適化余地として関数境界の外に置く（過剰設計の回避）。

import { AssociationProviderError } from '@rensoo/shared'

export interface RetryOptions {
  /** 最大リトライ回数（初回呼び出しを除く）。 */
  readonly retries?: number
  /** バックオフの基準ミリ秒（n 回目の待機 = baseDelayMs * 2^(n-1)）。 */
  readonly baseDelayMs?: number
  /** 待機関数（テストで差し替え可能にするため注入）。既定は setTimeout。 */
  readonly sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** エラーが再試行可能か（AssociationProviderError の retryable のみを対象にする）。 */
const isRetryable = (err: unknown): boolean =>
  err instanceof AssociationProviderError && err.retryable

/**
 * fn を実行し、再試行可能な失敗なら指数バックオフして最大 retries 回まで再試行する。
 * 非再試行エラーは即座に再スロー。全リトライ失敗時も最後のエラーを再スローする。
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> => {
  const retries = options.retries ?? 2
  const baseDelayMs = options.baseDelayMs ?? 200
  const sleep = options.sleep ?? defaultSleep

  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (!isRetryable(err) || attempt === retries) {
        throw err
      }
      await sleep(baseDelayMs * 2 ** attempt)
    }
  }
  // 到達しない（ループ内で必ず return か throw する）が、型のために再スロー。
  throw lastError
}
