import type { Hono } from 'hono'
import type { AuthEnv } from '../middleware/auth.js'

/** GET /api/health（疎通確認・認証不要）。 */
export const registerHealthRoutes = (app: Hono<AuthEnv>): void => {
  app.get('/api/health', (c) => c.json({ status: 'ok' }))
}
