// 編集画面サイドバーのノードツリー（M6・T20・DESIGN §2.1.1）。
// ストアの nodes/edges から純粋関数 buildNodeTree で親子ツリーを導出し、選択をキャンバスと同期する。

import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { useMindMapStore } from '../../store/mindMapStore'
import { buildNodeTree, type NodeTreeRow } from './buildNodeTree'

/** depth ごとのドット色（root=グラデ / depth1=アクセント / それ以外=ノード枠色）。 */
const dotStyle = (depth: number): CSSProperties => {
  if (depth === 0) {
    return {
      width: 9,
      height: 9,
      background: 'linear-gradient(135deg, var(--mm-root-a), var(--mm-root-b))',
    }
  }
  if (depth === 1) {
    return { width: 7, height: 7, background: 'var(--mm-accent)' }
  }
  return { width: 5, height: 5, background: 'var(--mm-node-border)' }
}

const TreeRow = ({
  row,
  active,
  onSelect,
}: {
  row: NodeTreeRow
  active: boolean
  onSelect: (id: string) => void
}) => (
  <button
    type="button"
    onClick={() => onSelect(row.id)}
    style={{ paddingLeft: 12 + row.depth * 15 }}
    className={`flex w-full items-center gap-2.5 rounded-lg py-1.5 pr-2.5 text-left transition-colors ${
      active ? 'bg-mm-accent/15 text-mm-accent' : 'hover:bg-mm-kid-bg'
    } ${row.depth === 0 ? 'text-sm font-bold' : row.depth === 1 ? 'text-[13px] font-semibold' : 'text-[13px] text-mm-kid-text'}`}
  >
    <span className="shrink-0 rounded-full" style={dotStyle(row.depth)} />
    <span className="truncate">{row.label}</span>
  </button>
)

export const NodeTreePanel = () => {
  const nodes = useMindMapStore((s) => s.nodes)
  const edges = useMindMapStore((s) => s.edges)
  const selectedNodeId = useMindMapStore((s) => s.selectedNodeId)
  const selectNode = useMindMapStore((s) => s.selectNode)

  const rows = buildNodeTree(nodes, edges)

  return (
    <aside className="z-10 flex w-[272px] shrink-0 flex-col border-r border-border bg-mm-panel">
      <div className="border-b border-border px-4 pb-3.5 pt-4">
        <Link
          to="/"
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          ← ホームに戻る
        </Link>
        <div className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          マップ構成
        </div>
      </div>

      <div className="mm-scroll flex-1 space-y-0.5 overflow-y-auto p-2.5">
        {rows.length === 0 ? (
          <p className="px-2 py-6 text-[13px] text-muted-foreground">
            まだノードがありません。キーワードから生成してください。
          </p>
        ) : (
          rows.map((row) => (
            <TreeRow
              key={row.id}
              row={row}
              active={row.id === selectedNodeId}
              onSelect={selectNode}
            />
          ))
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-3.5 text-xs text-muted-foreground">
        <span>ノード数</span>
        <span className="font-semibold text-foreground">{nodes.length}</span>
      </div>
    </aside>
  )
}
