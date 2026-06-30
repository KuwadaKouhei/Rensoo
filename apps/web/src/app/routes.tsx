// ルーティング定義（DESIGN §2.1）。MVP は単一画面（ホーム）。
// 認証・保存・一覧の画面は後続タスク（T12〜T14）でルートを追加する。
// 実際のマップ編集画面（キーワード入力→作成→描画）は T07 でこのホームに実装する。
import { Route, Routes } from 'react-router-dom'

/** ホーム（マップ編集画面の置き場・T07 で中身を実装）。現時点は基盤確認用のプレースホルダ。 */
const HomePage = () => (
  <main>
    <h1>Rensoo</h1>
    <p>キーワードから連想をマインドマップに広げます（画面は実装中です）。</p>
  </main>
)

/** アプリのルート定義。 */
export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
  </Routes>
)
