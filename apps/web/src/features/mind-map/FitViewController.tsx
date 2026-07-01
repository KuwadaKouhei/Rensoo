// 全体表示への自動フィット（M6・T22 / 調整）。React Flow の内側で使う（useReactFlow が要）。
// - 生成中: ノードが増えるたびに追従して全体を収める（遷移直後〜生成中も全体が見える）。
// - 完了時（generating→idle）: 最後に一度整える。
// - 完了後（idle 継続）: 手動ズーム/パンを尊重し、追従しない。

import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useMindMapStore } from '../../store/mindMapStore'
import { shouldFitViewOnStatusChange } from './fitViewOnComplete'

export const FitViewController = () => {
  const status = useMindMapStore((s) => s.status)
  const nodeCount = useMindMapStore((s) => s.nodes.length)
  const { fitView } = useReactFlow()
  const prev = useRef(status)

  useEffect(() => {
    const completed = shouldFitViewOnStatusChange(prev.current, status)
    prev.current = status
    // 生成中（各バッチ）と完了時のみフィットする。完了後の idle 継続では追従しない（手動操作を尊重）。
    if (status !== 'generating' && !completed) return
    if (nodeCount === 0) return
    // ノード反映後に整えるため次フレームで実行する。全体が収まるよう padding を取る（拡大率は抑制しない）。
    const raf = requestAnimationFrame(() => {
      void fitView({ duration: 400, padding: 0.2 })
    })
    return () => cancelAnimationFrame(raf)
  }, [status, nodeCount, fitView])

  return null
}
