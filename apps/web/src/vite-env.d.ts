/// <reference types="vite/client" />

// フロントで参照する公開環境変数の型（VITE_ 接頭辞のみがバンドルに露出する）。
// シークレット（LLM API キー等）はここに置かない＝サーバー側のみで扱う（AC-13/NFR-5）。
interface ImportMetaEnv {
  /** API サーバーのベース URL（未設定なら同一オリジン）。 */
  readonly VITE_API_BASE_URL?: string
  /** Supabase プロジェクト URL（公開値）。未設定なら認証機能は無効（ゲストのみ）。 */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon キー（公開可能な公開鍵。シークレットではない）。 */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
