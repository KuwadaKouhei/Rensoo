// 認証状態フック（DESIGN §7.1）。Supabase のセッションを購読し、ログインユーザーを返す。
// 認証未設定（supabase=null）のときは常に未ログイン扱い（ゲスト・AC-8）。

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

export interface AuthState {
  /** ログイン中のユーザー（未ログイン/認証無効は null）。 */
  readonly user: User | null
  /** 初期セッション確認中かどうか。 */
  readonly loading: boolean
}

export const useAuth = (): AuthState => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}
