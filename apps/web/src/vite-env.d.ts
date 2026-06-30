/// <reference types="vite/client" />

// フロントで参照する公開環境変数の型（VITE_ 接頭辞のみがバンドルに露出する）。
// シークレット（LLM API キー等）はここに置かない＝サーバー側のみで扱う（AC-13/NFR-5）。
interface ImportMetaEnv {
  /** API サーバーのベース URL（未設定なら同一オリジン）。 */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
