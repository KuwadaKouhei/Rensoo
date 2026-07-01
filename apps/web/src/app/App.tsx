// アプリのルートコンポーネント（テーマ＋ルーター）。
import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './routes'
import { ThemeProvider } from './ThemeProvider'

/** テーマとルーティングを内包したアプリ本体。 */
export const App = () => (
  <ThemeProvider>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </ThemeProvider>
)
