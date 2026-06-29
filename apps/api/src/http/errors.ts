import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { AssociationProviderError, type AssociationProviderErrorKind } from '@rensoo/shared'

/** 共通エラー応答（DESIGN §5.4）。message は必ず日本語。 */
export interface ErrorResponseBody {
  readonly error: {
    readonly code: string
    readonly message: string
    readonly retryable: boolean
  }
}

/** 連想プロバイダのエラー種別 → HTTP コード・ユーザー向け日本語メッセージの写像（DESIGN §5.4）。 */
const KIND_TO_HTTP: Record<
  AssociationProviderErrorKind,
  { code: string; status: ContentfulStatusCode; message: string }
> = {
  rate_limit: {
    code: 'RATE_LIMITED',
    status: 429,
    message: 'リクエストが集中しています。しばらくして再試行してください。',
  },
  timeout: {
    code: 'UPSTREAM_LLM',
    status: 502,
    message: '連想の生成がタイムアウトしました。再試行してください。',
  },
  upstream: {
    code: 'UPSTREAM_LLM',
    status: 502,
    message: '連想の生成に失敗しました。しばらくして再試行してください。',
  },
  invalid_response: {
    code: 'INTERNAL',
    status: 500,
    message: '連想の生成結果を処理できませんでした。再試行してください。',
  },
  unknown: {
    code: 'INTERNAL',
    status: 500,
    message: 'サーバーでエラーが発生しました。',
  },
}

/**
 * 例外を共通エラー応答へ変換する（Hono の onError ハンドラ）。
 * 詳細（cause・スタック・上流レスポンス）はサーバーログのみに出し、ユーザーには内部情報を出さない（AC-13）。
 */
export const handleError = (err: unknown, c: Context): Response => {
  if (err instanceof AssociationProviderError) {
    const mapped = KIND_TO_HTTP[err.kind]
    // 内部詳細はログのみ（API キー等はそもそも error に含めていない）。
    console.error(`[association] kind=${err.kind} message=${err.message}`)
    const body: ErrorResponseBody = {
      error: { code: mapped.code, message: mapped.message, retryable: err.retryable },
    }
    return c.json(body, mapped.status)
  }

  console.error('[unhandled]', err)
  const body: ErrorResponseBody = {
    error: { code: 'INTERNAL', message: 'サーバーでエラーが発生しました。', retryable: true },
  }
  return c.json(body, 500)
}
