// マインドマップ編集画面（M6・DESIGN §2.1.1）。
// 左にノードツリーのサイドバー、右に放射状キャンバス＋トップバー＋操作 UI を配置する。
// 生成の実行/停止は本ページが単一の展開コントローラ（useExpansionStream）で所有し、
// ツールバーの「作成/停止」とトップバーの「再生成」が同じストリームに作用するようにする。

import { useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { MindMapCanvas } from '../features/mind-map/MindMapCanvas'
import { MindMapToolbar } from '../features/mind-map/MindMapToolbar'
import { NodeEditPopover } from '../features/mind-map/NodeEditPopover'
import { NodeTreePanel } from '../features/mind-map/NodeTreePanel'
import { EditorTopBar } from '../features/mind-map/EditorTopBar'
import { GeneratingOverlay } from '../features/mind-map/GeneratingOverlay'
import { GenerationSettingsPanel } from '../features/generation-settings/GenerationSettingsPanel'
import { LoginButton } from '../features/auth-save/LoginButton'
import { SaveDialog } from '../features/auth-save/SaveDialog'
import { useExpansionStream } from '../features/mind-map/useExpansionStream'
import { createAssociationMap } from '../features/mind-map/createAssociationMap'
import { useMindMapStore } from '../store/mindMapStore'

/** ホーム画面から渡される遷移状態（起点キーワード）。 */
interface EditorLocationState {
  readonly keyword?: string
}

export const EditorPage = () => {
  const location = useLocation()
  // ホームの「生成する」から遷移してきた場合、この語で生成を自動開始する。
  const autoStartKeyword = (location.state as EditorLocationState | null)?.keyword

  const { start, stop } = useExpansionStream()

  // 単一の生成トリガ（自動=SSE 連鎖 / 手動=単発）。空入力は無視。
  const create = useCallback(
    (keyword: string): void => {
      const kw = keyword.trim()
      if (!kw) return
      if (useMindMapStore.getState().mode === 'auto') {
        start(kw)
      } else {
        void createAssociationMap(kw)
      }
    },
    [start],
  )

  // ホームから渡された起点キーワードで、初回マウント時に一度だけ生成を開始する。
  const started = useRef(false)
  useEffect(() => {
    const kw = autoStartKeyword?.trim()
    if (kw && !started.current) {
      started.current = true
      create(kw)
    }
  }, [autoStartKeyword, create])

  return (
    <main className="flex h-screen w-screen overflow-hidden">
      <NodeTreePanel />

      <div className="relative flex-1 overflow-hidden">
        <EditorTopBar onRegenerate={create} />

        <div className="absolute left-3 top-[76px] z-10 flex max-w-[min(88vw,460px)] flex-col gap-3 rounded-xl border border-border bg-card/95 p-3 text-card-foreground shadow-lg backdrop-blur">
          <div className="flex items-center justify-end">
            <LoginButton />
          </div>
          <MindMapToolbar onCreate={create} onStop={stop} />
          <GenerationSettingsPanel />
          <SaveDialog />
          <NodeEditPopover />
        </div>

        <MindMapCanvas onNodeSelect={(id) => useMindMapStore.getState().selectNode(id)} />
        <GeneratingOverlay />
      </div>
    </main>
  )
}
