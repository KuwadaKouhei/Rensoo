// 型付き API クライアントの土台（DESIGN §2.1）。
// fetch をこの1箇所に閉じ込め、ネットワーク失敗・非2xx・非JSON を ApiError に正規化する。
// レスポンスの「中身の」スキーマ検証は呼び出し側（associations.ts 等）が shared の Zod で行う。

import { errorFromResponse, invalidResponseError, networkError } from './errors'

/** API ベース URL（未設定なら同一オリジン）。シークレットは含めない（ビルド時公開値のみ）。 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

/**
 * JSON を送受信する基底 fetch。返り値は unknown（呼び出し側が Zod 検証する）。
 * - fetch 自体の reject（ネットワーク不通）→ networkError
 * - 非 2xx → 本文を共通エラー応答として解釈し errorFromResponse
 * - 2xx だが JSON でない → invalidResponseError
 */
export const apiFetch = async (path: string, init?: RequestInit): Promise<unknown> => {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...init?.headers,
      },
    })
  } catch (err) {
    throw networkError(err)
  }

  if (!res.ok) {
    // エラー本文は共通形を期待するが、壊れていても errorFromResponse がフォールバックする。
    const body = await res.json().catch(() => undefined)
    throw errorFromResponse(res.status, body)
  }

  // 204 No Content や空ボディ（例: DELETE）は JSON パースせず undefined を返す。
  if (res.status === 204) {
    return undefined
  }
  const text = await res.text()
  if (text.length === 0) {
    return undefined
  }

  try {
    return JSON.parse(text) as unknown
  } catch (err) {
    throw invalidResponseError(err)
  }
}

/** JSON ボディ付き POST のショートカット。 */
export const postJson = (path: string, body: unknown): Promise<unknown> =>
  apiFetch(path, { method: 'POST', body: JSON.stringify(body) })
