// マインドマップ編集画面（M6・DESIGN §2.1.1）。
// 左にノードツリーのサイドバー、右に放射状キャンバス＋操作 UI（作成・設定・モード・保存・ノード編集）を配置する。
// 生成中ロック/ローディング（T21）・完了後 fitView（T22）は後続タスクで拡充する。

import { useLocation } from 'react-router-dom'
import { MindMapCanvas } from '../features/mind-map/MindMapCanvas'
import { MindMapToolbar } from '../features/mind-map/MindMapToolbar'
import { NodeEditPopover } from '../features/mind-map/NodeEditPopover'
import { NodeTreePanel } from '../features/mind-map/NodeTreePanel'
import { GenerationSettingsPanel } from '../features/generation-settings/GenerationSettingsPanel'
import { LoginButton } from '../features/auth-save/LoginButton'
import { SaveDialog } from '../features/auth-save/SaveDialog'
import { useMindMapStore } from '../store/mindMapStore'

/** ホーム画面から渡される遷移状態（起点キーワード）。 */
interface EditorLocationState {
  readonly keyword?: string
}

export const EditorPage = () => {
  const location = useLocation()
  // ホームの「生成する」から遷移してきた場合、この語で生成を自動開始する（MindMapToolbar が一度だけ実行）。
  const autoStartKeyword = (location.state as EditorLocationState | null)?.keyword

  return (
    <main className="flex h-screen w-screen overflow-hidden">
      <NodeTreePanel />

      <div className="relative flex-1 overflow-hidden">
        <div className="absolute left-3 top-3 z-10 flex max-w-[min(88vw,480px)] flex-col gap-3 rounded-xl border border-border bg-card/95 p-3 text-card-foreground shadow-lg backdrop-blur">
          <div className="flex items-center justify-end">
            <LoginButton />
          </div>
          <MindMapToolbar autoStartKeyword={autoStartKeyword} />
          <GenerationSettingsPanel />
          <SaveDialog />
          <NodeEditPopover />
        </div>

        <MindMapCanvas onNodeSelect={(id) => useMindMapStore.getState().selectNode(id)} />
      </div>
    </main>
  )
}
