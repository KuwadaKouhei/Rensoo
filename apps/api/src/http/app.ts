import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AssociationProvider } from '@rensoo/shared'
import { handleError } from './errors.js'
import { optionalAuth, type AuthEnv, type JwtVerifier } from './middleware/auth.js'
import { registerHealthRoutes } from './routes/health.routes.js'
import { registerAssociationRoutes } from './routes/associations.routes.js'
import { registerExpansionRoutes } from './routes/expansion.routes.js'
import { InMemoryExpansionLock } from '../app/expansion/expansionLock.js'

export interface AppDeps {
  readonly associationProvider: AssociationProvider
  /** 許可するフロントのオリジン（未指定なら全許可。本番では必ず指定する）。 */
  readonly corsOrigin?: string
  /**
   * JWT 検証関数（DESIGN §7）。指定時は生成系に任意認証を適用し、ログイン時のみ userId を載せる。
   * 未指定時は認証なし（ゲストのみ）。保存系（必須認証）は別タスク（T13）で requireAuth を使う。
   */
  readonly jwtVerifier?: JwtVerifier
}

/** アプリで使う Hono の型（Context 変数に userId を持つ）。 */
export type AppHono = Hono<AuthEnv>

/**
 * Hono アプリを組み立てる（DI で依存を注入）。
 * Hono への依存はこの http 層に閉じ込め、ドメイン/オーケストレーションは Hono を知らない（DESIGN §2.2）。
 */
export const createApp = (deps: AppDeps): AppHono => {
  const app = new Hono<AuthEnv>()

  app.use('/api/*', cors({ origin: deps.corsOrigin ?? '*' }))

  // 生成系の任意認証（未認証可・AC-8）。検証関数がある場合のみ適用する。
  if (deps.jwtVerifier) {
    app.use('/api/*', optionalAuth(deps.jwtVerifier))
  }

  // 自走展開の多重実行抑制ロック（アプリインスタンス単位のインメモリ）。
  const expansionLock = new InMemoryExpansionLock()

  registerHealthRoutes(app)
  registerAssociationRoutes(app, deps.associationProvider)
  registerExpansionRoutes(app, deps.associationProvider, expansionLock)

  app.onError(handleError)

  return app
}
