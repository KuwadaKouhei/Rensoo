// ルーティング定義（DESIGN §2.1）。MVP は単一画面（ホーム）。
// 認証・保存・一覧の画面は後続タスク（T12〜T14）でルートを追加する。
// キーワード入力→「作成」→生成の操作 UI は T07 でこのホームに追加する。
import { Route, Routes } from 'react-router-dom'
import { MindMapCanvas } from '../features/mind-map/MindMapCanvas'

/**
 * ホーム（マップ編集画面）。現時点はマインドマップ描画キャンバスを全画面で表示する。
 * キーワード入力・「作成」ボタン等の操作 UI は T07 で重ねて実装する。
 */
const HomePage = () => (
  <main style={{ width: '100vw', height: '100vh' }}>
    <MindMapCanvas />
  </main>
)

/** アプリのルート定義。 */
export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
  </Routes>
)
