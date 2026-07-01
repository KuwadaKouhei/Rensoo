import { serve } from '@hono/node-server'
import Anthropic from '@anthropic-ai/sdk'
import { createApp } from './http/app.js'
import { createJwksVerifier, type JwtVerifier } from './http/middleware/auth.js'
import { ClaudeAssociationProvider } from './infra/providers/claudeAssociationProvider.js'
import {
  createSupabaseRepositoryFactory,
  type MindMapRepositoryFactory,
} from './infra/repositories/supabaseMindMapRepository.js'

// 起動時の DI 配線（実装の選択はこの1箇所に集約・DESIGN §2.3）。
// API キーはサーバー環境変数のみで扱い、フロントには出さない（AC-13/NFR-5）。.env ファイルは読まない。
const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) {
  // 握りつぶさず明示的に失敗させる（CODING_PHILOSOPHY）。
  throw new Error('環境変数 ANTHROPIC_API_KEY が設定されていません')
}

const client = new Anthropic({ apiKey })
// 空文字・空白のみ（例: .env の `ASSOCIATION_MODEL=`）は未指定として扱う（既定モデルへ倒す）。
const associationModel = process.env.ASSOCIATION_MODEL?.trim() || undefined
const associationProvider = new ClaudeAssociationProvider(client, {
  model: associationModel,
})

// JWT 検証（DESIGN §7.4）。SUPABASE_URL があれば JWKS で検証する。未設定なら認証なし（ゲストのみ）。
// 保存系（必須認証）は T13 で有効化する。
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '')
const jwtVerifier: JwtVerifier | undefined = supabaseUrl
  ? createJwksVerifier({
      jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      issuer: `${supabaseUrl}/auth/v1`,
      audience: 'authenticated',
    })
  : undefined

// 保存系（RLS 引き継ぎ）。SUPABASE_URL と SUPABASE_ANON_KEY が揃えば有効化する。
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const repositoryFactory: MindMapRepositoryFactory | undefined =
  supabaseUrl && supabaseAnonKey
    ? createSupabaseRepositoryFactory({ url: supabaseUrl, anonKey: supabaseAnonKey })
    : undefined

// CORS: WEB_ORIGIN 未設定だと全許可（'*'）にフォールバックする。
// 本番（NODE_ENV=production）では設定漏れをフェイルクローズ（起動失敗）にし、開発では警告に留める。
const webOrigin = process.env.WEB_ORIGIN
if (!webOrigin) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '本番では WEB_ORIGIN（許可するフロントのオリジン）が必須です。CORS の全許可フォールバックを防ぐため設定してください。',
    )
  }
  console.warn(
    '[起動] WEB_ORIGIN が未設定です。CORS を全オリジン許可で起動します（開発用）。本番では WEB_ORIGIN を必ず指定してください。',
  )
}

const app = createApp({
  associationProvider,
  corsOrigin: webOrigin,
  jwtVerifier,
  repositoryFactory,
})

const port = Number(process.env.PORT ?? 8787)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Rensoo API サーバーを起動しました: http://localhost:${info.port}`)
})
