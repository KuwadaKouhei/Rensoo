import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AssociationProvider } from '@rensoo/shared'
import { handleError } from './errors.js'
import { registerHealthRoutes } from './routes/health.routes.js'
import { registerAssociationRoutes } from './routes/associations.routes.js'
import { registerExpansionRoutes } from './routes/expansion.routes.js'
import { InMemoryExpansionLock } from '../app/expansion/expansionLock.js'

export interface AppDeps {
  readonly associationProvider: AssociationProvider
  /** 許可するフロントのオリジン（未指定なら全許可。本番では必ず指定する）。 */
  readonly corsOrigin?: string
}

/**
 * Hono アプリを組み立てる（DI で依存を注入）。
 * Hono への依存はこの http 層に閉じ込め、ドメイン/オーケストレーションは Hono を知らない（DESIGN §2.2）。
 */
export const createApp = (deps: AppDeps): Hono => {
  const app = new Hono()

  app.use('/api/*', cors({ origin: deps.corsOrigin ?? '*' }))

  // 自走展開の多重実行抑制ロック（アプリインスタンス単位のインメモリ）。
  const expansionLock = new InMemoryExpansionLock()

  registerHealthRoutes(app)
  registerAssociationRoutes(app, deps.associationProvider)
  registerExpansionRoutes(app, deps.associationProvider, expansionLock)

  app.onError(handleError)

  return app
}
