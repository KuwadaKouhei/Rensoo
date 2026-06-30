// 保存系 API クライアント（DESIGN §5.2/§5.3・AC-10,11）。
// すべて認証必須のため Authorization: Bearer <JWT> を付与する。応答は shared の Zod で検証してから扱う。

import {
  mapListResponseSchema,
  mapSummarySchema,
  savedMapSchema,
  type MapSummary,
  type SaveMapRequest,
  type SavedMap,
} from '@rensoo/shared'
import { apiFetch } from './client'
import { invalidResponseError } from './errors'

/** 認証ヘッダを作る。 */
const authHeader = (token: string): Record<string, string> => ({ authorization: `Bearer ${token}` })

/** マップ一覧（更新日時降順はサーバー側で保証）。 */
export const listMaps = async (token: string): Promise<readonly MapSummary[]> => {
  const json = await apiFetch('/api/maps', { headers: authHeader(token) })
  const parsed = mapListResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw invalidResponseError(parsed.error)
  }
  return parsed.data.maps
}

/** マップ取得（本人のみ。他人/不存在は API が 404＝ApiError）。 */
export const getMap = async (token: string, id: string): Promise<SavedMap> => {
  const json = await apiFetch(`/api/maps/${encodeURIComponent(id)}`, { headers: authHeader(token) })
  const parsed = savedMapSchema.safeParse(json)
  if (!parsed.success) {
    throw invalidResponseError(parsed.error)
  }
  return parsed.data
}

/** マップ保存（新規/上書き）。 */
export const saveMap = async (token: string, input: SaveMapRequest): Promise<MapSummary> => {
  const json = await apiFetch('/api/maps', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  })
  const parsed = mapSummarySchema.safeParse(json)
  if (!parsed.success) {
    throw invalidResponseError(parsed.error)
  }
  return parsed.data
}

/** マップ削除（本人のみ）。 */
export const deleteMap = async (token: string, id: string): Promise<void> => {
  await apiFetch(`/api/maps/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeader(token),
  })
}
