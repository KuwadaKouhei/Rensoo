// マインドマップ編集画面（M6・レイアウト再構成・DESIGN §2.1.1）。
// 配置: 左=ノードツリー / 中央=放射状キャンバス＋上部タイトル / 左上=生成コントロール（モード・件数・作成/停止/再生成）
//       右上=アカウント（ログイン・保存） / 右=ノード編集サイドバー（ノード選択時のみ）。
// 生成の実行/停止は本ページが単一の展開コントローラ（useExpansionStream）で所有し、コントロールから作用させる。

import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { MindMapCanvas } from '../features/mind-map/MindMapCanvas'
import { EditorControls } from '../features/mind-map/EditorControls'
import { NodeEditSidebar } from '../features/mind-map/NodeEditSidebar'
import { EditorTopBar } from '../features/mind-map/EditorTopBar'
import { GeneratingOverlay } from '../features/mind-map/GeneratingOverlay'
import { NodeTreePanel } from '../features/mind-map/NodeTreePanel'
import { LoginButton } from '../features/auth-save/LoginButton'
import { SaveDialog } from '../features/auth-save/SaveDialog'
import { useExpansionStream } from '../features/mind-map/useExpansionStream'
import { createAssociationMap } from '../features/mind-map/createAssociationMap'
import { useMindMapStore } from '../store/mindMapStore'
import { useAuth } from '../auth/useAuth'

/** ホーム画面から渡される遷移状態（起点キーワード）。 */
interface EditorLocationState {
  readonly keyword?: string
}

export const EditorPage = () => {
  const location = useLocation()
  // ホームの「生成する」から遷移してきた場合、この語で生成を自動開始する。
  const autoStartKeyword = (location.state as EditorLocationState | null)?.keyword

  const { start, stop } = useExpansionStream()
  const { user } = useAuth()
  // 左上の生成コントロールパネルの開閉（ハンバーガーでトグル・既定は開）。
  const [controlsOpen, setControlsOpen] = useState(true)

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

  // ホームから渡された起点キーワードで、マウント時に一度だけ生成を開始する。
  // 開始を次のタスクへ遅延し、StrictMode の throwaway マウントの cleanup でキャンセルする
  // （開始直後に abort→再開されない競合を避け、本物のマウントでのみ一度だけ走らせる）。
  useEffect(() => {
    const kw = autoStartKeyword?.trim()
    if (!kw) return
    let cancelled = false
    const timer = setTimeout(() => {
      if (!cancelled) create(kw)
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [autoStartKeyword, create])

  return (
    <main className="flex h-screen w-screen overflow-hidden">
      <NodeTreePanel />

      <div className="relative flex-1 overflow-hidden">
        <EditorTopBar />

        {/* 左上: 生成コントロール。ハンバーガーで開閉トグル。オーバーレイより前面に置く。 */}
        <div className="absolute left-3 top-3 z-30 flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={() => setControlsOpen((v) => !v)}
            aria-label={controlsOpen ? '生成コントロールを閉じる' : '生成コントロールを開く'}
            aria-expanded={controlsOpen}
            className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-card/95 text-foreground shadow-lg backdrop-blur transition-colors hover:bg-muted"
          >
            {controlsOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          {controlsOpen && <EditorControls onCreate={create} onStop={stop} />}
        </div>

        {/* 右上: 認証状態で出し分ける。未ログイン=ログインのみ / ログイン=タイトル＋保存のみ。 */}
        <div className="absolute right-3 top-3 z-30 flex items-start gap-2">
          {user ? <SaveDialog /> : <LoginButton />}
        </div>

        <MindMapCanvas onNodeSelect={(id) => useMindMapStore.getState().selectNode(id)} />
        <GeneratingOverlay />
      </div>

      {/* 右: ノード編集サイドバー（ノード選択時のみ開く・生成中は非表示）。 */}
      <NodeEditSidebar />
    </main>
  )
}
