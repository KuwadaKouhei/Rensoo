import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'

// エントリポイント。アプリ本体（ルーター含む）を #root にマウントする。
const rootElement = document.getElementById('root')
if (!rootElement) {
  // エラーは握りつぶさず明示する（CODING_PHILOSOPHY）。
  throw new Error('ルート要素 #root が見つかりません')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
