// マインドマップのドメインモデル（FW/SDK/React 非依存のプレーン型）。
// 物理的な保存形（DATABASE.md の snapshot JSONB）とは別レイヤの「正本」となる型。

/** ノードの由来。起点 / 自動連鎖 / 手動追加 を区別する（DATABASE.md §1.4）。 */
export type NodeOrigin = 'root' | 'auto' | 'manual'

/** 描画座標（再レイアウト可能なため任意）。 */
export interface NodePosition {
  readonly x: number
  readonly y: number
}

/** 連想マップの1ノード。id はマップ内ローカルID（クライアント生成の文字列）。 */
export interface MindMapNode {
  readonly id: string
  /** 連想語（日本語・トリム済み・非空）。 */
  readonly text: string
  /** 起点=0, 子=1, 孫=2 ... */
  readonly depth: number
  readonly origin: NodeOrigin
  readonly position?: NodePosition
}

/** 有向エッジ（親→子）。source/target は必ず存在する node.id を指す（孤立エッジ禁止・AC-7）。 */
export interface MindMapEdge {
  readonly id: string
  readonly source: string
  readonly target: string
}

/** 自走展開の生成設定（既定: 6 / 3 / 50。DESIGN.md §6.1）。 */
export interface GenerationSettings {
  /** 1ノードあたりの生成件数（3〜10、既定6）。 */
  readonly countPerNode: number
  /** 自動連鎖の最大深さ（1〜5、既定3）。 */
  readonly maxDepth: number
  /** 総ノード数の上限（2〜100、既定50）。 */
  readonly maxNodes: number
}

/** 生成設定の既定値（DESIGN.md §6.1 で確定）。 */
export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  countPerNode: 6,
  maxDepth: 3,
  maxNodes: 50,
}
