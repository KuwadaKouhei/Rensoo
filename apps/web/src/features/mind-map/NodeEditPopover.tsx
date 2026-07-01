// ノード手動編集 UI（追加・編集・削除＋手動展開・FR-15,16,17 / AC-7）。
// 選択中ノード（store.selectedNodeId）に対する操作を提供する。整合（孤立エッジ除去）は
// ストアの純粋アクションが担い、この UI はロジックを持たない（PLAN_PHILOSOPHY）。

import { useEffect, useState } from 'react'
import { Button } from '../../ui/Button'
import { useMindMapStore } from '../../store/mindMapStore'
import { expandNode } from './expandNode'

export const NodeEditPopover = () => {
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

  // 生成中は編集ポップオーバーを開かない（生成完了後に編集/削除を再有効化・T21）。
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
    <div className="node-popover" role="dialog" aria-label="ノード編集">
      <div className="node-popover__header">
        <strong>{node.text}</strong>
        <Button
          type="button"
          variant="secondary"
          onClick={() => selectNode(null)}
          aria-label="閉じる"
        >
          ×
        </Button>
      </div>

      {mode === 'manual' && (
        <Button type="button" onClick={() => void expandNode(node.id)}>
          この語を展開
        </Button>
      )}

      <label className="node-popover__field">
        <span>名前を編集</span>
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          aria-label="ノード名"
        />
        <Button type="button" variant="secondary" onClick={saveEdit} disabled={!editText.trim()}>
          保存
        </Button>
      </label>

      <label className="node-popover__field">
        <span>子ノードを追加</span>
        <input
          type="text"
          value={childText}
          onChange={(e) => setChildText(e.target.value)}
          placeholder="追加する語"
          aria-label="追加する子ノードの語"
        />
        <Button type="button" variant="secondary" onClick={addChild} disabled={!childText.trim()}>
          追加
        </Button>
      </label>

      <Button type="button" variant="secondary" onClick={() => removeNode(node.id)}>
        このノードを削除
      </Button>
    </div>
  )
}
