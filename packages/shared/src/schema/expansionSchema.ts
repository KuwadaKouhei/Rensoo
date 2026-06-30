import { z } from 'zod'
import { generationSettingsSchema } from './generationSettingsSchema.js'

/**
 * 自走展開（SSE）の契約スキーマ（DESIGN.md §5.3/§6.2〜§6.5）。
 * `POST /api/expansion/stream` のリクエストと、サーバーが送る SSE イベントペイロードを
 * フロント/サーバーで同一スキーマとして共有する（CODING_PHILOSOPHY「外部入出力はスキーマ検証」）。
 *
 * DESIGN のイベント素描（node-batch は `words` のみ）を実装では拡張し、子ノードに
 * **サーバー採番の id を含める**。これにより後続バッチの `parentId` をフロントが一意に解決でき、
 * クライアント/サーバー間でノード同一性がずれない（軽微な具体化・理由をここに明記）。
 */

/** 展開開始リクエスト。settings は既定（6/3/50）を Zod で補完する。 */
export const expansionRequestSchema = z.object({
  rootInput: z.string().min(1).max(100),
  settings: generationSettingsSchema,
})

/** SSE で送る1ノード（id はサーバー採番、text は整形済み連想語）。 */
export const expansionNodeSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(40),
})

/**
 * node-batch: 親ノード配下に子ノード群を追加する指示。
 * parentId が null のバッチは起点（root, depth=0）を表す。
 */
export const expansionNodeBatchSchema = z.object({
  parentId: z.string().min(1).nullable(),
  depth: z.number().int().min(0),
  nodes: z.array(expansionNodeSchema),
})

/** progress: 進行状況（総ノード数・到達 depth）。 */
export const expansionProgressSchema = z.object({
  totalNodes: z.number().int().min(0),
  depth: z.number().int().min(0),
})

/** 停止理由。max_depth/max_nodes=停止条件、user_stop=接続クローズ、completed=自然終了（フロンティア枯渇）。 */
export const expansionStopReasonSchema = z.enum([
  'max_depth',
  'max_nodes',
  'user_stop',
  'completed',
])

/** stopped: 展開の終了通知。 */
export const expansionStoppedSchema = z.object({
  reason: expansionStopReasonSchema,
  totalNodes: z.number().int().min(0),
})

/** error: 展開中の失敗（日本語 message・再試行可否）。内部情報は含めない（AC-13）。 */
export const expansionErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
})

/** SSE イベント名（フロント/サーバーで共有して取り違いを防ぐ）。 */
export const EXPANSION_EVENT = {
  nodeBatch: 'node-batch',
  progress: 'progress',
  stopped: 'stopped',
  error: 'error',
} as const

export type ExpansionRequest = z.infer<typeof expansionRequestSchema>
export type ExpansionNode = z.infer<typeof expansionNodeSchema>
export type ExpansionNodeBatch = z.infer<typeof expansionNodeBatchSchema>
export type ExpansionProgress = z.infer<typeof expansionProgressSchema>
export type ExpansionStopReason = z.infer<typeof expansionStopReasonSchema>
export type ExpansionStopped = z.infer<typeof expansionStoppedSchema>
export type ExpansionError = z.infer<typeof expansionErrorSchema>
