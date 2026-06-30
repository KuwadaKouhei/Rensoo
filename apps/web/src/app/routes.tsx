// ルーティング定義（DESIGN §2.1）。MVP は単一画面（ホーム）。
// 認証・保存・一覧の画面は後続タスク（T12〜T14）でルートを追加する。
// キーワード入力→「作成」→生成の操作 UI は T07 でこのホームに追加する。
import { Route, Routes } from 'react-router-dom'
import { MindMapCanvas } from '../features/mind-map/MindMapCanvas'
import { MindMapToolbar } from '../features/mind-map/MindMapToolbar'
import { NodeEditPopover } from '../features/mind-map/NodeEditPopover'
import { GenerationSettingsPanel } from '../features/generation-settings/GenerationSettingsPanel'
import { useMindMapStore } from '../store/mindMapStore'

/**
 * ホーム（マップ編集画面）。全画面の描画キャンバスに、操作 UI（入力・作成・件数設定・モード）を重ねる。
 * キーワードを入力して「作成」すると連想マップが表示・展開される（AC-1,2）。
 * ノードクリックでそのノードを選択し、編集ポップオーバー（展開・追加・編集・削除）を開く（AC-4,7）。
 */
const HomePage = () => (
  <main className="map-screen">
    <div className="map-screen__overlay">
      <MindMapToolbar />
      <GenerationSettingsPanel />
      <NodeEditPopover />
    </div>
    <MindMapCanvas onNodeSelect={(id) => useMindMapStore.getState().selectNode(id)} />
  </main>
)

/** アプリのルート定義。 */
export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
  </Routes>
)
