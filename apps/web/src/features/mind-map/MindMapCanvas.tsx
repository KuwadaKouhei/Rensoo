// マインドマップ描画（React Flow・DESIGN §2.1/§3.3）。
// ドメイン状態は Zustand に置き、React Flow へはそこから「供給するだけ」にする（描画ライブラリ分離）。
// React Flow 内蔵 state（useNodesState/useEdgesState）にドメインを握らせない（PLAN_PHILOSOPHY）。
// 既定レイアウトは放射状（radialLayout）。ノードは中心座標で配置するため nodeOrigin=[0.5,0.5] を使う。

import { useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { MindMapEdge, MindMapNode } from '@rensoo/shared'
import { radialLayout } from '../../mindmap-layout/radialLayout'
import type { LayoutFn } from '../../mindmap-layout/layout'
import { useMindMapStore } from '../../store/mindMapStore'
import { isInteractionLocked } from './generatingUi'
import { FitViewController } from './FitViewController'
import { ZoomControls } from './ZoomControls'
import {
  mindMapNodeTypes,
  nodeTypeForDepth,
  type MindMapNodeData,
} from './nodes/mindMapNodeTypes'

/** ノード中心を layout 座標に合わせる（放射状レイアウトは中心原点の座標を返す）。 */
const NODE_ORIGIN: [number, number] = [0.5, 0.5]

export interface MindMapCanvasProps {
  /** ノードクリック時に対象ノード ID を受け取るハンドラ（選択・手動展開の起点）。 */
  readonly onNodeSelect?: (nodeId: string) => void
  /** レイアウト関数（既定 radial・差し替え/テスト用に注入可能）。 */
  readonly layout?: LayoutFn
}

/** ドメインエッジ → React Flow エッジ（深さで線の太さを変える・デザイン準拠）。 */
const toFlowEdges = (
  edges: readonly MindMapEdge[],
  depthOf: Map<string, number>,
): Edge[] =>
  edges.map((edge) => {
    const childDepth = depthOf.get(edge.target) ?? 2
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'straight',
      style: {
        stroke: 'var(--mm-link)',
        strokeWidth: childDepth <= 1 ? 2.4 : 1.4,
        opacity: childDepth <= 1 ? 0.85 : 0.5,
      },
    }
  })

/**
 * 連想マップを描画するキャンバス。ズーム/パンは React Flow 標準機能を利用する。
 * 座標は layout() で都度算出し（ノードは座標を持たない設計）、選択状態はストアから供給する。
 */
export const MindMapCanvas = ({ onNodeSelect, layout = radialLayout }: MindMapCanvasProps) => {
  const nodes = useMindMapStore((s) => s.nodes)
  const edges = useMindMapStore((s) => s.edges)
  const selectedNodeId = useMindMapStore((s) => s.selectedNodeId)
  const status = useMindMapStore((s) => s.status)
  // 生成中はノードのクリック（選択・手動展開）を禁止する（T21）。
  const locked = isInteractionLocked(status)

  // 座標算出は nodes/edges/layout が変わったときだけ（選択変更では再計算しない）。
  const positions = useMemo(
    () => new Map(layout({ nodes, edges }).map((p) => [p.id, p.position])),
    [nodes, edges, layout],
  )

  const flowNodes = useMemo<Node<MindMapNodeData>[]>(
    () =>
      nodes.map((node: MindMapNode) => ({
        id: node.id,
        type: nodeTypeForDepth(node.depth),
        position: positions.get(node.id) ?? node.position ?? { x: 0, y: 0 },
        data: { label: node.text, selected: node.id === selectedNodeId },
      })),
    [nodes, positions, selectedNodeId],
  )

  const flowEdges = useMemo(
    () => toFlowEdges(edges, new Map(nodes.map((n) => [n.id, n.depth]))),
    [edges, nodes],
  )

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    if (locked) return // 生成中はクリックを無視する。
    onNodeSelect?.(node.id)
  }

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={mindMapNodeTypes}
      nodeOrigin={NODE_ORIGIN}
      onNodeClick={handleNodeClick}
      fitView
      // ドメイン状態は React Flow に持たせないため、ドラッグ等の内蔵編集はストア経由でのみ反映する方針。
      nodesDraggable={false}
      proOptions={{ hideAttribution: true }}
      style={{ background: 'var(--mm-bg2)' }}
    >
      <Background variant={BackgroundVariant.Lines} gap={42} color="var(--mm-grid)" />
      <FitViewController />
      <ZoomControls />
    </ReactFlow>
  )
}
