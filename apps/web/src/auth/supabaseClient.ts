// Supabase Auth クライアント（DESIGN §7.1）。Google OAuth ログインと JWT 取得に使う。
// URL/anon キーは公開値（VITE_ 接頭辞）。anon キーは公開可能で、シークレット（LLM キー等）はここに置かない。
// 環境変数が未設定なら null を返し、アプリはゲスト専用として動作する（AC-8 を壊さない）。

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** 設定済みなら Supabase クライアント、未設定なら null（認証無効）。 */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null

/** 認証が利用可能か（環境変数が揃っているか）。 */
export const isAuthEnabled = (): boolean => supabase !== null

/** Google OAuth ログインを開始する（コールバックは現在のオリジンへ）。 */
export const signInWithGoogle = async (): Promise<void> => {
  if (!supabase) return
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) {
    // 握りつぶさずユーザーへ通知できるよう再スロー（呼び出し側で日本語表示）。
    throw new Error('ログインを開始できませんでした。時間をおいて再度お試しください。')
  }
}

/** ログアウトする。 */
export const signOut = async (): Promise<void> => {
  if (!supabase) return
  await supabase.auth.signOut()
}

/** 現在のアクセストークン（JWT）。保存系 API の Authorization に使う（未ログインは null）。 */
export const getAccessToken = async (): Promise<string | null> => {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
