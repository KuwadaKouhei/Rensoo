// layout() の第一実装: Dagre による自動レイアウト（DESIGN §3.3 / TECH_STACK §2.5）。
// 純粋関数（同一入力→同一出力）。React Flow とは独立しており、モックなしでユニットテスト可能。
// より高機能な ELK へは同じ LayoutFn 境界で差し替えできる（Dagre メンテ非活発リスクの吸収）。

import dagre from '@dagrejs/dagre'
import type { LayoutFn, PositionedNode } from './layout'

/** ノードの想定描画サイズ（レイアウト計算用の固定値）。React Flow 既定ノードの目安に合わせる。 */
const NODE_WIDTH = 160
const NODE_HEIGHT = 44

/** 同階層ノード間の間隔 / 階層間の間隔。 */
const NODE_SEP = 40
const RANK_SEP = 80

/**
 * Dagre でノード座標を決定する。
 * - Dagre はノード中心座標を返すため、React Flow 互換の左上原点へ変換する。
 * - 入力順を保った決定的な配置（同一入力なら毎回同一座標）。
 */
export const dagreLayout: LayoutFn = ({ nodes, edges, direction = 'TB' }): PositionedNode[] => {
  const graph = new dagre.graphlib.Graph()
  graph.setGraph({ rankdir: direction, nodesep: NODE_SEP, ranksep: RANK_SEP })
  // エッジのラベル既定値を要求されるため空オブジェクトを返す。
  graph.setDefaultEdgeLabel(() => ({}))

  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target)
  }

  dagre.layout(graph)

  return nodes.map((node) => {
    const positioned = graph.node(node.id)
    // 中心座標 → 左上原点へ変換。
    return {
      id: node.id,
      position: {
        x: positioned.x - NODE_WIDTH / 2,
        y: positioned.y - NODE_HEIGHT / 2,
      },
    }
  })
}
