// 生成完了時に一度だけ全体表示へ整える（M6・T22）。React Flow の内側で使う（useReactFlow が要）。
// status が generating→idle に変化した瞬間だけ fitView する。段階描画中や手動ズーム後は追従しない。

import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useMindMapStore } from '../../store/mindMapStore'
import { shouldFitViewOnStatusChange } from './fitViewOnComplete'

export const FitViewController = () => {
  const status = useMindMapStore((s) => s.status)
  const { fitView } = useReactFlow()
  const prev = useRef(status)

  useEffect(() => {
    const fit = shouldFitViewOnStatusChange(prev.current, status)
    prev.current = status
    if (!fit) return
    // ノード反映後に整えるため次フレームで実行する。
    const raf = requestAnimationFrame(() => {
      void fitView({ duration: 400, padding: 0.2 })
    })
    return () => cancelAnimationFrame(raf)
  }, [status, fitView])

  return null
}
