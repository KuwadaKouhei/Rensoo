// ノード編集サイドバー（右・M6 レイアウト再構成）。
// キャンバス/ツリーでノードを選択すると右側に開き、名前編集・子追加・削除・（手動時）展開を提供する。
// 生成中は表示しない（完了後に編集/削除を再有効化・T21）。整合（孤立エッジ除去）はストアの純粋アクションが担う。

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useMindMapStore } from '../../store/mindMapStore'
import { expandNode } from './expandNode'

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

export const NodeEditSidebar = () => {
  const selectedNodeId = useMindMapStore((s) => s.selectedNodeId)
  const nodes = useMindMapStore((s) => s.nodes)
  const mode = useMindMapStore((s) => s.mode)
  const status = useMindMapStore((s) => s.status)
  const addChildNode = useMindMapStore((s) => s.addChildNode)
  const editNode = useMindMapStore((s) => s.editNode)
  const removeNode = useMindMapStore((s) => s.removeNode)
  const selectNode = useMindMapStore((s) => s.selectNode)

  const node = nodes.find((n) => n.id === selectedNodeId) ?? null

  const [childText, setChildText] = useState('')
  const [editText, setEditText] = useState('')

  // 選択ノードが変わったら入力欄を同期する。
  useEffect(() => {
    setEditText(node?.text ?? '')
    setChildText('')
  }, [selectedNodeId, node?.text])

  // 選択なし、または生成中はサイドバーを閉じる。
  if (!node || status === 'generating') {
    return null
  }

  const addChild = (): void => {
    const text = childText.trim()
    if (!text) return
    addChildNode(node.id, text)
    setChildText('')
  }

  const saveEdit = (): void => {
    const text = editText.trim()
    if (!text || text === node.text) return
    editNode(node.id, text)
  }

  return (
    <aside
      className="z-10 flex w-[300px] shrink-0 flex-col border-l border-border bg-mm-panel"
      role="dialog"
      aria-label="ノード編集"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5">
        <div className="min-w-0">
          <div className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            ノード編集
          </div>
          <div className="truncate text-sm font-bold text-foreground">{node.text}</div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="閉じる"
          onClick={() => selectNode(null)}
        >
          ✕
        </Button>
      </div>

      <div className="mm-scroll flex-1 space-y-4 overflow-y-auto p-4">
        {mode === 'manual' && (
          <Button type="button" className="w-full" onClick={() => void expandNode(node.id)}>
            この語を展開
          </Button>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">名前を編集</label>
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            aria-label="ノード名"
            className={inputClass}
          />
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={saveEdit}
            disabled={!editText.trim() || editText.trim() === node.text}
          >
            名前を保存
          </Button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">子ノードを追加</label>
          <input
            type="text"
            value={childText}
            onChange={(e) => setChildText(e.target.value)}
            placeholder="追加する語"
            aria-label="追加する子ノードの語"
            className={inputClass}
          />
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={addChild}
            disabled={!childText.trim()}
          >
            追加
          </Button>
        </div>
      </div>

      <div className="border-t border-border p-4">
        <Button
          type="button"
          variant="destructive"
          className="w-full"
          onClick={() => removeNode(node.id)}
        >
          このノードを削除
        </Button>
      </div>
    </aside>
  )
}
