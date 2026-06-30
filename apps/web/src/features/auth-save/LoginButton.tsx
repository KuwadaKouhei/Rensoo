// ログイン/ログアウト UI（DESIGN §2.1/§7.1・AC-9 の導線）。
// 認証未設定（環境変数なし）のときは何も表示しない＝ゲスト専用で動作（AC-8）。

import { useState } from 'react'
import { Button } from '../../ui/Button'
import { useAuth } from '../../auth/useAuth'
import { isAuthEnabled, signInWithGoogle, signOut } from '../../auth/supabaseClient'

export const LoginButton = () => {
  const { user, loading } = useAuth()
  const [error, setError] = useState<string | null>(null)

  if (!isAuthEnabled() || loading) {
    return null
  }

  const login = async (): Promise<void> => {
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました。')
    }
  }

  return (
    <div className="auth-box">
      {user ? (
        <>
          <span className="auth-box__user">{user.email ?? 'ログイン中'}</span>
          <Button type="button" variant="secondary" onClick={() => void signOut()}>
            ログアウト
          </Button>
        </>
      ) : (
        <Button type="button" onClick={() => void login()}>
          Google でログイン
        </Button>
      )}
      {error && (
        <div role="alert" className="auth-box__error">
          {error}
        </div>
      )}
    </div>
  )
}
