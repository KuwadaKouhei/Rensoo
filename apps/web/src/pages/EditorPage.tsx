// マインドマップ編集画面（M6・DESIGN §2.1.1）。
// 現状は既存の操作 UI（作成・設定・モード・保存・ノード編集）を全画面キャンバスへ重ねる構成。
// サイドバーのノードツリー（T20）・生成中ロック/ローディング（T21）・完了後 fitView（T22）は後続タスクで拡充する。

import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MindMapCanvas } from '../features/mind-map/MindMapCanvas'
import { MindMapToolbar } from '../features/mind-map/MindMapToolbar'
import { NodeEditPopover } from '../features/mind-map/NodeEditPopover'
import { GenerationSettingsPanel } from '../features/generation-settings/GenerationSettingsPanel'
import { LoginButton } from '../features/auth-save/LoginButton'
import { SaveDialog } from '../features/auth-save/SaveDialog'
import { MapListPanel } from '../features/auth-save/MapListPanel'
import { useMindMapStore } from '../store/mindMapStore'

/** ホーム画面から渡される遷移状態（起点キーワード）。 */
interface EditorLocationState {
  readonly keyword?: string
}

export const EditorPage = () => {
  const location = useLocation()
  // ホームの「作成」から遷移してきた場合、この語で生成を自動開始する（MindMapToolbar が一度だけ実行）。
  const autoStartKeyword = (location.state as EditorLocationState | null)?.keyword

  // 保存成功時に一覧を再取得するためのトリガ。
  const [reloadKey, setReloadKey] = useState(0)

  return (
    <main className="relative h-screen w-screen">
      <div className="absolute left-3 top-3 z-10 flex max-w-[min(92vw,520px)] flex-col gap-3 rounded-xl border border-border bg-card/95 p-3 text-card-foreground shadow-lg backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← ホームに戻る
          </Link>
          <LoginButton />
        </div>
        <MindMapToolbar autoStartKeyword={autoStartKeyword} />
        <GenerationSettingsPanel />
        <SaveDialog onSaved={() => setReloadKey((k) => k + 1)} />
        <MapListPanel reloadKey={reloadKey} />
        <NodeEditPopover />
      </div>
      <MindMapCanvas onNodeSelect={(id) => useMindMapStore.getState().selectNode(id)} />
    </main>
  )
}
