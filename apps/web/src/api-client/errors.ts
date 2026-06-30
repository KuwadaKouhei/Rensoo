// API クライアントのエラー表現（DESIGN §2.1「エラー→日本語メッセージ変換・再試行」）。
// サーバーは共通エラー応答 { error: { code, message(日本語), retryable } } を返す（API §5.4）。
// ここではそれを型付きの ApiError へ正規化し、UI が message をそのまま表示・retryable で再試行判定できるようにする。

import { z } from 'zod'

/** サーバー共通エラー応答のスキーマ（API errors.ts の ErrorResponseBody と対応）。 */
export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
  }),
})

/** API 呼び出しの失敗を表す型付きエラー。message は必ずユーザー向け日本語。 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    /** HTTP ステータス（ネットワーク到達不可など HTTP 以前の失敗は 0）。 */
    readonly status: number,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'ApiError'
  }
}

/** ネットワーク到達不可（fetch 自体が reject）を表す日本語エラー。 */
export const networkError = (cause: unknown): ApiError =>
  new ApiError(
    'ネットワークに接続できません。接続を確認して再試行してください。',
    'NETWORK',
    true,
    0,
    { cause },
  )

/** サーバー応答を解釈できない場合のエラー（スキーマ不一致・非 JSON 等）。 */
export const invalidResponseError = (cause: unknown): ApiError =>
  new ApiError(
    'サーバーの応答を解釈できませんでした。再試行してください。',
    'INVALID_RESPONSE',
    true,
    200,
    {
      cause,
    },
  )

/**
 * 非 2xx 応答の本文から ApiError を組み立てる。
 * 本文が共通エラー形でなければステータスに応じた汎用日本語メッセージにフォールバックする。
 */
export const errorFromResponse = (status: number, body: unknown): ApiError => {
  const parsed = apiErrorBodySchema.safeParse(body)
  if (parsed.success) {
    const { code, message, retryable } = parsed.data.error
    return new ApiError(message, code, retryable, status)
  }
  // 想定外の本文: 5xx は一時的とみなし再試行可、それ以外は不可。
  const retryable = status >= 500
  return new ApiError('サーバーでエラーが発生しました。', 'UNKNOWN', retryable, status)
}
