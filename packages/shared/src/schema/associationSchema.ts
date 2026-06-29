import { z } from 'zod'

/**
 * 連想生成 API のリクエストスキーマ（DESIGN.md §5.5）。
 * `POST /api/associations` の入力検証に使う。空入力・件数レンジ外は 400（NFR-7 / AC-1,2）。
 */
export const associateRequestSchema = z.object({
  input: z.string().min(1).max(100),
  count: z.number().int().min(3).max(10).default(6),
  locale: z.literal('ja').default('ja'),
})

/** パース前（default 適用前）の入力型。 */
export type AssociateRequestInput = z.input<typeof associateRequestSchema>
/** パース後（default 適用済み）の確定型。 */
export type AssociateRequestParsed = z.infer<typeof associateRequestSchema>
