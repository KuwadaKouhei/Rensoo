// ルーティング定義（M6・DESIGN §2.1.1）。2 画面構成: `/`＝ホーム、`/map`＝マインドマップ編集。
// ドメイン状態（Zustand ストア）は画面をまたいで共有されるため、ホームで開始した生成は編集画面へ引き継がれる。

import { Route, Routes } from 'react-router-dom'
import { HomePage } from '../pages/HomePage'
import { EditorPage } from '../pages/EditorPage'

/** アプリのルート定義。 */
export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/map" element={<EditorPage />} />
  </Routes>
)
