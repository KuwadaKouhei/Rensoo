// 画面横断ヘッダー（M6・DESIGN §2.1.1）。ロゴ「MindWeave」＋テーマ切替＋ログイン導線。
// ホーム/編集の両画面で共有する。ロゴクリックでホームへ戻る。

import { Link } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'
import { LoginButton } from '@/features/auth-save/LoginButton'

export const AppHeader = () => (
  <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background px-6 py-4 md:px-8">
    <Link to="/" className="flex items-center gap-3" aria-label="MindWeave ホーム">
      <span
        className="size-8 rounded-[9px] shadow-[0_4px_14px_var(--mm-ring)]"
        style={{ background: 'linear-gradient(135deg, var(--mm-root-a), var(--mm-root-b))' }}
      />
      <span className="font-display text-xl font-bold tracking-tight text-foreground">
        MindWeave
      </span>
    </Link>
    <div className="flex items-center gap-3">
      <ThemeToggle />
      <LoginButton />
    </div>
  </header>
)
