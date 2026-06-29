import { z } from 'zod'

/**
 * 自走展開の生成設定スキーマ（DESIGN.md §6.1 の既定値・範囲）。
 * フロント（設定 UI）/ サーバー（受信検証）で共用する。範囲外は検証エラー（AC-2 / NFR-7）。
 */
export const generationSettingsSchema = z.object({
  countPerNode: z.number().int().min(3).max(10).default(6),
  maxDepth: z.number().int().min(1).max(5).default(3),
  maxNodes: z.number().int().min(2).max(100).default(50),
})

/** パース前（default 適用前）の入力型。 */
export type GenerationSettingsInput = z.input<typeof generationSettingsSchema>
/** パース後（default 適用済み）の確定型。 */
export type GenerationSettingsParsed = z.infer<typeof generationSettingsSchema>
