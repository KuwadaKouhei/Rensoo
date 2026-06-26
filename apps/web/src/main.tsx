import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// T01 は「最小で起動可能な空アプリ」。画面・状態・連想機能は T05 以降で実装する。
const rootElement = document.getElementById('root')
if (!rootElement) {
  // エラーは握りつぶさず明示する（CODING_PHILOSOPHY）。
  throw new Error('ルート要素 #root が見つかりません')
}

createRoot(rootElement).render(
  <StrictMode>
    <main>
      <h1>Rensoo</h1>
      <p>準備中です。</p>
    </main>
  </StrictMode>,
)
