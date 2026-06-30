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

/**
 * 連想生成 API の応答スキーマ（`POST /api/associations` の戻り値・DESIGN.md §5.3）。
 * サーバーは normalizeAssociations 済みの語を返す。フロントはこのスキーマで受信検証してから扱う
 * （CODING_PHILOSOPHY「外部入出力はスキーマ検証」）。件数厳密一致はサーバー側で担保済み。
 */
export const associateResponseSchema = z.object({
  words: z.array(z.object({ word: z.string().min(1).max(40) })),
  meta: z
    .object({
      provider: z.string().min(1),
      model: z.string().min(1).optional(),
    })
    .optional(),
})

/** 連想生成 API の応答型。 */
export type AssociateResponse = z.infer<typeof associateResponseSchema>
