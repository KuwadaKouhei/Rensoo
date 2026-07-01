// マインドマップのカスタムノード（M6・T20・MindWeave デザイン準拠）。
// depth により root/branch/leaf の3種を出し分ける。色はすべて --mm-* トークン経由（テーマ追従）。
// エッジ接続用の Handle は中心に隠して置き、線がノード中心から出るように見せる（放射状マップの見た目）。

import { Handle, Position, type NodeProps, type NodeTypes } from '@xyflow/react'
import type { CSSProperties } from 'react'

/** カスタムノードが受け取る表示データ。 */
export interface MindMapNodeData extends Record<string, unknown> {
  readonly label: string
  /** ストアの選択状態（キャンバスとツリーの相互ハイライト）。 */
  readonly selected?: boolean
}

/** 中心に置く不可視ハンドル（source/target 兼用）。線をノード中心から出す。 */
const hiddenHandle: CSSProperties = {
  opacity: 0,
  width: 1,
  height: 1,
  minWidth: 1,
  minHeight: 1,
  border: 'none',
  background: 'transparent',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
}

const NodeHandles = () => (
  <>
    <Handle type="target" position={Position.Top} style={hiddenHandle} isConnectable={false} />
    <Handle type="source" position={Position.Bottom} style={hiddenHandle} isConnectable={false} />
  </>
)

const baseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  userSelect: 'none',
  fontFamily: "'Zen Kaku Gothic New', sans-serif",
  animation: 'mmpop .5s cubic-bezier(.34,1.4,.5,1) both',
}

const RootNode = ({ data }: NodeProps) => {
  const d = data as MindMapNodeData
  return (
    <div
      style={{
        ...baseStyle,
        padding: '22px 36px',
        borderRadius: 999,
        background: 'linear-gradient(135deg, var(--mm-root-a), var(--mm-root-b))',
        color: '#fff',
        fontWeight: 700,
        fontSize: 27,
        letterSpacing: '.02em',
        boxShadow: '0 0 0 7px var(--mm-ring), 0 16px 44px var(--mm-ring)',
      }}
    >
      {d.label}
      <NodeHandles />
    </div>
  )
}

const BranchNode = ({ data }: NodeProps) => {
  const d = data as MindMapNodeData
  return (
    <div
      style={{
        ...baseStyle,
        padding: '13px 24px',
        borderRadius: 999,
        background: 'var(--mm-node-bg)',
        color: 'var(--mm-node-text)',
        border: `1.5px solid ${d.selected ? 'var(--mm-accent)' : 'var(--mm-node-border)'}`,
        fontWeight: 600,
        fontSize: 17,
        boxShadow: d.selected
          ? '0 0 0 4px var(--mm-ring), 0 8px 22px var(--mm-shadow)'
          : '0 6px 18px var(--mm-shadow)',
      }}
    >
      {d.label}
      <NodeHandles />
    </div>
  )
}

const LeafNode = ({ data }: NodeProps) => {
  const d = data as MindMapNodeData
  return (
    <div
      style={{
        ...baseStyle,
        padding: '9px 17px',
        borderRadius: 999,
        background: 'var(--mm-kid-bg)',
        color: 'var(--mm-kid-text)',
        border: `1px solid ${d.selected ? 'var(--mm-accent)' : 'var(--mm-node-border)'}`,
        fontWeight: 500,
        fontSize: 14,
        boxShadow: d.selected ? '0 0 0 3px var(--mm-ring)' : 'none',
      }}
    >
      {d.label}
      <NodeHandles />
    </div>
  )
}

/** React Flow に渡すノード型マップ。 */
export const mindMapNodeTypes: NodeTypes = {
  root: RootNode,
  branch: BranchNode,
  leaf: LeafNode,
}

/** depth からノード型キーを決める（0=root, 1=branch, それ以外=leaf）。 */
export const nodeTypeForDepth = (depth: number): keyof typeof mindMapNodeTypes =>
  depth <= 0 ? 'root' : depth === 1 ? 'branch' : 'leaf'
