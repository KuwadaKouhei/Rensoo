// ルーティング定義（DESIGN §2.1）。MVP は単一画面（ホーム）。
// 認証・保存・一覧の画面は後続タスク（T12〜T14）でルートを追加する。
// キーワード入力→「作成」→生成の操作 UI は T07 でこのホームに追加する。
import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { MindMapCanvas } from '../features/mind-map/MindMapCanvas'
import { MindMapToolbar } from '../features/mind-map/MindMapToolbar'
import { NodeEditPopover } from '../features/mind-map/NodeEditPopover'
import { GenerationSettingsPanel } from '../features/generation-settings/GenerationSettingsPanel'
import { LoginButton } from '../features/auth-save/LoginButton'
import { SaveDialog } from '../features/auth-save/SaveDialog'
import { MapListPanel } from '../features/auth-save/MapListPanel'
import { useMindMapStore } from '../store/mindMapStore'

/**
 * ホーム（マップ編集画面）。全画面の描画キャンバスに、操作 UI（入力・作成・件数設定・モード・保存）を重ねる。
 * キーワードを入力して「作成」すると連想マップが表示・展開される（AC-1,2）。
 * ノードクリックでそのノードを選択し、編集ポップオーバー（展開・追加・編集・削除）を開く（AC-4,7）。
 * ログイン時は保存・一覧・開く・削除ができる（AC-9,10,11）。
 */
const HomePage = () => {
  // 保存成功時に一覧を再取得するためのトリガ。
  const [reloadKey, setReloadKey] = useState(0)
  return (
    <main className="map-screen">
      <div className="map-screen__overlay">
        <LoginButton />
        <MindMapToolbar />
        <GenerationSettingsPanel />
        <SaveDialog onSaved={() => setReloadKey((k) => k + 1)} />
        <MapListPanel reloadKey={reloadKey} />
        <NodeEditPopover />
      </div>
      <MindMapCanvas onNodeSelect={(id) => useMindMapStore.getState().selectNode(id)} />
    </main>
  )
}

/** アプリのルート定義。 */
export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
  </Routes>
)
