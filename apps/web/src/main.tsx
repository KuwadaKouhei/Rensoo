import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Tailwind＋デザイントークンを最初に読み込む（以降の app.css が個別に上書きできるように）。
import './index.css'
// 既存オーバーレイ操作 UI（ツールバー/編集/保存 等）のクラススタイル。T20 以降で段階的に Tailwind へ移行する。
import './app/app.css'
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
