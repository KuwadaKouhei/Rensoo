import { z } from 'zod'

/**
 * LLM 構造化出力の二重検証用スキーマ（DESIGN.md §5.5）。
 * 構造化出力で「形式」を保証しつつ、サーバー側で Zod により再検証する
 * （CODING_PHILOSOPHY「外部入出力はスキーマ検証」）。
 *
 * 上限 20 は安全弁。件数（count）厳密一致は後処理 normalizeAssociations のトリムで担保する。
 */
export const llmAssociationResponseSchema = z.object({
  words: z
    .array(z.object({ word: z.string().min(1).max(40) }))
    .min(1)
    .max(20),
})

export type LlmAssociationResponse = z.infer<typeof llmAssociationResponseSchema>
