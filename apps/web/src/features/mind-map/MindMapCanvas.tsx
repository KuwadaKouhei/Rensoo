// マインドマップ描画（React Flow・DESIGN §2.1/§3.3）。
// ドメイン状態は Zustand に置き、React Flow へはそこから「供給するだけ」にする（描画ライブラリ分離）。
// React Flow 内蔵 state（useNodesState/useEdgesState）にドメインを握らせない（PLAN_PHILOSOPHY）。

import { useMemo } from 'react'
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { MindMapEdge, MindMapNode } from '@rensoo/shared'
import { dagreLayout } from '../../mindmap-layout/dagreLayout'
import type { LayoutFn } from '../../mindmap-layout/layout'
import { useMindMapStore } from '../../store/mindMapStore'

/** ノードに載せる表示用データ。 */
interface MindMapNodeData extends Record<string, unknown> {
  readonly label: string
  readonly origin: MindMapNode['origin']
}

export interface MindMapCanvasProps {
  /** ノードクリック時に対象ノード ID を受け取るハンドラ（手動展開などの起点・T08 で配線）。 */
  readonly onNodeSelect?: (nodeId: string) => void
  /** レイアウト関数（既定 dagre・差し替えテスト用に注入可能）。 */
  readonly layout?: LayoutFn
}

/** ドメインノード/エッジ＋座標 → React Flow のノード/エッジへ変換する。 */
const toFlowGraph = (
  nodes: readonly MindMapNode[],
  edges: readonly MindMapEdge[],
  layout: LayoutFn,
): { flowNodes: Node<MindMapNodeData>[]; flowEdges: Edge[] } => {
  const positions = new Map(layout({ nodes, edges }).map((p) => [p.id, p.position]))

  const flowNodes: Node<MindMapNodeData>[] = nodes.map((node) => ({
    id: node.id,
    position: positions.get(node.id) ?? node.position ?? { x: 0, y: 0 },
    data: { label: node.text, origin: node.origin },
  }))

  const flowEdges: Edge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }))

  return { flowNodes, flowEdges }
}

/**
 * 連想マップを描画するキャンバス。ズーム/パンは React Flow 標準機能を利用する。
 * ノード/エッジはストアから供給され、座標は layout() で都度算出する（ノードは座標を持たない設計）。
 */
export const MindMapCanvas = ({ onNodeSelect, layout = dagreLayout }: MindMapCanvasProps) => {
  const nodes = useMindMapStore((s) => s.nodes)
  const edges = useMindMapStore((s) => s.edges)

  const { flowNodes, flowEdges } = useMemo(
    () => toFlowGraph(nodes, edges, layout),
    [nodes, edges, layout],
  )

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    onNodeSelect?.(node.id)
  }

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      onNodeClick={handleNodeClick}
      fitView
      // ドメイン状態は React Flow に持たせないため、ドラッグ等の内蔵編集はストア経由でのみ反映する方針。
      nodesDraggable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls />
    </ReactFlow>
  )
}
