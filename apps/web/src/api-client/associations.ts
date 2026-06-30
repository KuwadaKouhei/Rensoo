// 連想生成 API の呼び出し（DESIGN §5.3 / AC-1,2）。
// 送信前にリクエストを、受信後にレスポンスを shared の Zod で検証してから型付き値として返す
//（CODING_PHILOSOPHY「外部入出力は同一スキーマで検証」）。

import {
  associateRequestSchema,
  associateResponseSchema,
  type AssociateRequestInput,
  type AssociateResponse,
} from '@rensoo/shared'
import { postJson } from './client'
import { invalidResponseError } from './errors'

/**
 * 入力語から連想語を取得する（単発生成）。
 * - リクエストは associateRequestSchema で検証（不正なら呼び出し側のバグとして throw）。
 * - レスポンスは associateResponseSchema で検証し、失敗時は invalidResponseError。
 */
export const requestAssociations = async (
  req: AssociateRequestInput,
): Promise<AssociateResponse> => {
  const body = associateRequestSchema.parse(req)
  const json = await postJson('/api/associations', body)

  const parsed = associateResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw invalidResponseError(parsed.error)
  }
  return parsed.data
}
