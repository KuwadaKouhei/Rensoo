import { serve } from '@hono/node-server'
import Anthropic from '@anthropic-ai/sdk'
import { createApp } from './http/app.js'
import { createJwksVerifier, type JwtVerifier } from './http/middleware/auth.js'
import { ClaudeAssociationProvider } from './infra/providers/claudeAssociationProvider.js'

// 起動時の DI 配線（実装の選択はこの1箇所に集約・DESIGN §2.3）。
// API キーはサーバー環境変数のみで扱い、フロントには出さない（AC-13/NFR-5）。.env ファイルは読まない。
const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) {
  // 握りつぶさず明示的に失敗させる（CODING_PHILOSOPHY）。
  throw new Error('環境変数 ANTHROPIC_API_KEY が設定されていません')
}

const client = new Anthropic({ apiKey })
const associationProvider = new ClaudeAssociationProvider(client, {
  model: process.env.ASSOCIATION_MODEL,
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

const app = createApp({
  associationProvider,
  corsOrigin: process.env.WEB_ORIGIN,
  jwtVerifier,
})

const port = Number(process.env.PORT ?? 8787)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Rensoo API サーバーを起動しました: http://localhost:${info.port}`)
})
