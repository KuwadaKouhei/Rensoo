// エラー応答の単一の正本（DESIGN §5.4）。全ルート・全層で同じ code→HTTP/日本語/retryable を使う。
// 個別の文言が必要な箇所は message を上書きできるが、code/status/既定 retryable はここに集約する。

import type { ContentfulStatusCode } from 'hono/utils/http-status'

/** API 全体で使うエラーコード（DESIGN §5.4）。 */
export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'UPSTREAM_LLM'
  | 'INTERNAL'

/** 共通エラー応答ボディ。message は必ず日本語、retryable は再試行可否（AC-12）。 */
export interface ErrorResponseBody {
  readonly error: {
    readonly code: ErrorCode
    readonly message: string
    readonly retryable: boolean
  }
}

interface ErrorSpec {
  readonly status: ContentfulStatusCode
  readonly message: string
  readonly retryable: boolean
}

/** code → HTTP ステータス・既定日本語メッセージ・既定 retryable。 */
export const ERROR_SPECS: Record<ErrorCode, ErrorSpec> = {
  VALIDATION: { status: 400, message: '入力が正しくありません。', retryable: false },
  UNAUTHORIZED: { status: 401, message: 'ログインが必要です。', retryable: false },
  FORBIDDEN: { status: 403, message: 'この操作は許可されていません。', retryable: false },
  NOT_FOUND: { status: 404, message: '対象が見つかりません。', retryable: false },
  CONFLICT: {
    status: 409,
    message: '処理が実行中です。完了後に再試行してください。',
    retryable: true,
  },
  RATE_LIMITED: {
    status: 429,
    message: 'リクエストが集中しています。しばらくして再試行してください。',
    retryable: true,
  },
  UPSTREAM_LLM: {
    status: 502,
    message: '連想の生成に失敗しました。しばらくして再試行してください。',
    retryable: true,
  },
  INTERNAL: { status: 500, message: 'サーバーでエラーが発生しました。', retryable: true },
}

/** code に対する HTTP ステータスを返す。 */
export const errorStatus = (code: ErrorCode): ContentfulStatusCode => ERROR_SPECS[code].status

/** エラー応答ボディを組み立てる（message/retryable は必要時のみ上書き）。 */
export const errorBody = (
  code: ErrorCode,
  overrides: { message?: string; retryable?: boolean } = {},
): ErrorResponseBody => {
  const spec = ERROR_SPECS[code]
  return {
    error: {
      code,
      message: overrides.message ?? spec.message,
      retryable: overrides.retryable ?? spec.retryable,
    },
  }
}

/**
 * アプリ層で投げる型付きエラー。onError が code に応じた応答へ写像する（握りつぶさない）。
 * 詳細（cause）はログのみに出し、ユーザー応答には内部情報を含めない（AC-13）。
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly retryable?: boolean,
    options?: { cause?: unknown },
  ) {
    super(message ?? ERROR_SPECS[code].message, options)
    this.name = 'AppError'
  }
}
