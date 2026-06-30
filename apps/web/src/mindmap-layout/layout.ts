// 描画レイアウトの抽象（拡張点・DESIGN §3.3）。
// 自動レイアウトを関数境界で抽象化し、Dagre↔ELK を差し替え可能にする（PLAN_PHILOSOPHY 変動点の抽象化）。
// フロント固有（座標計算にサーバー不要）なので shared に上げず apps/web 内に置く（過剰共有の回避）。

import type { MindMapEdge, MindMapNode } from '@rensoo/shared'

/** レイアウト計算の入力。direction は上→下(TB) / 左→右(LR)。 */
export interface LayoutInput {
  readonly nodes: readonly MindMapNode[]
  readonly edges: readonly MindMapEdge[]
  readonly direction?: 'TB' | 'LR'
}

/** レイアウト計算の出力（ノード ID → 配置座標）。座標は React Flow 互換の左上原点。 */
export interface PositionedNode {
  readonly id: string
  readonly position: { readonly x: number; readonly y: number }
}

/** 実装: dagreLayout / elkLayout。フロント側の純粋関数として差し替え可能。 */
export type LayoutFn = (input: LayoutInput) => readonly PositionedNode[]
