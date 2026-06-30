// アプリのルートコンポーネント（レイアウト＋ルーター）。
import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './routes'
import './app.css'

/** ルーティングを内包したアプリ本体。 */
export const App = () => (
  <BrowserRouter>
    <AppRoutes />
  </BrowserRouter>
)
