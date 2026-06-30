import { z } from 'zod'
import { generationSettingsSchema } from './generationSettingsSchema.js'

/** ノードスキーマ（DATABASE.md §1.4 snapshot の論理形状）。 */
export const mindMapNodeSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(40),
  depth: z.number().int().min(0),
  origin: z.enum(['root', 'auto', 'manual']),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
})

/** エッジスキーマ（有向: 親→子）。 */
export const mindMapEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
})

/**
 * 全エッジの source/target が nodes に存在することを検証する（孤立エッジ禁止・AC-7）。
 * フロント（保存前）/ サーバー（保存時）双方で同一スキーマにより整合を担保する。
 */
const hasNoOrphanEdges = (
  nodes: ReadonlyArray<{ id: string }>,
  edges: ReadonlyArray<{ source: string; target: string }>,
): boolean => {
  const ids = new Set(nodes.map((n) => n.id))
  return edges.every((e) => ids.has(e.source) && ids.has(e.target))
}

const ORPHAN_EDGE_MESSAGE = 'エッジの source/target が存在しないノードを参照しています'

/** 保存マップの実体（メタ＋ノード/エッジ＋設定）。`POST /api/maps` のリクエスト本体（DESIGN.md §5.3）。 */
export const saveMapRequestSchema = z
  .object({
    /** 省略時は新規作成。指定時は上書き保存。 */
    id: z.string().min(1).optional(),
    title: z.string().min(1).max(100),
    nodes: z.array(mindMapNodeSchema),
    edges: z.array(mindMapEdgeSchema),
    settings: generationSettingsSchema,
  })
  .refine((data) => hasNoOrphanEdges(data.nodes, data.edges), {
    message: ORPHAN_EDGE_MESSAGE,
    path: ['edges'],
  })

/** 一覧/保存レスポンスのマップ要約（DESIGN.md §5.3）。 */
export const mapSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  updatedAt: z.string().min(1),
})

/** `GET /api/maps/:id` の応答（保存済みマップ本体）。フロントが受信検証して再編集に使う。 */
export const savedMapSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).max(100),
    nodes: z.array(mindMapNodeSchema),
    edges: z.array(mindMapEdgeSchema),
    settings: generationSettingsSchema,
  })
  .refine((data) => hasNoOrphanEdges(data.nodes, data.edges), {
    message: ORPHAN_EDGE_MESSAGE,
    path: ['edges'],
  })

/** マップ一覧 `GET /api/maps` の応答。 */
export const mapListResponseSchema = z.object({
  maps: z.array(mapSummarySchema),
})

/** DB に格納する snapshot JSONB の形状（version を持つ。将来のマイグレーション余地・DATABASE.md §1.4）。 */
export const mindMapSnapshotSchema = z
  .object({
    version: z.literal(1).default(1),
    nodes: z.array(mindMapNodeSchema),
    edges: z.array(mindMapEdgeSchema),
  })
  .refine((data) => hasNoOrphanEdges(data.nodes, data.edges), {
    message: ORPHAN_EDGE_MESSAGE,
    path: ['edges'],
  })

export type SaveMapRequest = z.infer<typeof saveMapRequestSchema>
export type MapSummary = z.infer<typeof mapSummarySchema>
export type SavedMap = z.infer<typeof savedMapSchema>
export type MapListResponse = z.infer<typeof mapListResponseSchema>
export type MindMapSnapshotShape = z.infer<typeof mindMapSnapshotSchema>
