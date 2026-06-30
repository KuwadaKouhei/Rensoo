import type { Context } from 'hono'
import { AssociationProviderError, type AssociationProviderErrorKind } from '@rensoo/shared'
import {
  AppError,
  ERROR_SPECS,
  errorBody,
  type ErrorCode,
  type ErrorResponseBody,
} from './errorResponses.js'

// 後方互換: 既存の import 経路（'../errors.js'）を維持する。正本は errorResponses.ts。
export type { ErrorResponseBody, ErrorCode }
export { errorBody, AppError } from './errorResponses.js'

/** 連想プロバイダのエラー種別 → 公開エラーコードの写像（DESIGN §5.4）。 */
const KIND_TO_CODE: Record<AssociationProviderErrorKind, ErrorCode> = {
  rate_limit: 'RATE_LIMITED',
  timeout: 'UPSTREAM_LLM',
  upstream: 'UPSTREAM_LLM',
  invalid_response: 'INTERNAL',
  unknown: 'INTERNAL',
}

/**
 * 例外を共通エラー応答へ変換する（Hono の onError）。全層のエラーをここで一貫日本語化する（AC-12）。
 * 詳細（cause・スタック・上流レスポンス・APIキー）はサーバーログのみに出し、ユーザーには出さない（AC-13）。
 */
export const handleError = (err: unknown, c: Context): Response => {
  if (err instanceof AppError) {
    console.error(`[app] code=${err.code} message=${err.message}`)
    const body = errorBody(err.code, { message: err.message, retryable: err.retryable })
    return c.json(body, ERROR_SPECS[err.code].status)
  }

  if (err instanceof AssociationProviderError) {
    const code = KIND_TO_CODE[err.kind]
    // 内部詳細はログのみ（APIキー等はそもそも error に含めていない）。
    console.error(`[association] kind=${err.kind} message=${err.message}`)
    // retryable は元エラーの判定を尊重する（コードの既定ではなく実際の再試行可否）。
    const body = errorBody(code, { retryable: err.retryable })
    return c.json(body, ERROR_SPECS[code].status)
  }

  console.error('[unhandled]', err)
  return c.json(errorBody('INTERNAL'), ERROR_SPECS.INTERNAL.status)
}
