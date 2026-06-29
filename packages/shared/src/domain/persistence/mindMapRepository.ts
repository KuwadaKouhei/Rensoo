import type { GenerationSettings, MindMapEdge, MindMapNode } from '../mind-map/model.js'

/** 一覧表示用のマップ要約（FR-21 / AC-10）。 */
export interface MindMapSummary {
  readonly id: string
  readonly title: string
  /** ISO8601。 */
  readonly updatedAt: string
}

/** 保存されるマップの実体（メタ＋ノード/エッジ＋生成設定）。 */
export interface MindMapSnapshot {
  readonly id: string
  readonly title: string
  readonly nodes: readonly MindMapNode[]
  readonly edges: readonly MindMapEdge[]
  readonly settings: GenerationSettings
}

/**
 * 永続化の抽象（拡張点）。実装: SupabaseMindMapRepository など。
 *
 * userId を引数で受け取るが、真の認可境界は DB の RLS（auth.uid()）。
 * 実装はユーザー JWT を引き継いだクライアントで発行し、アプリ層チェックと DB 層強制を二重化する
 * （CODING_PHILOSOPHY / DESIGN §3.2 / AC-11）。
 */
export interface MindMapRepository {
  /** 認証ユーザーのマップ一覧（本人のもののみ）。 */
  list(userId: string): Promise<readonly MindMapSummary[]>
  /** 1件取得（他人のものは取得不可。なければ null）。 */
  get(userId: string, mapId: string): Promise<MindMapSnapshot | null>
  /** 新規作成 or 上書き保存（本人のもののみ）。 */
  save(userId: string, snapshot: MindMapSnapshot): Promise<MindMapSummary>
  /** 削除（本人のもののみ）。 */
  remove(userId: string, mapId: string): Promise<void>
}
