import type { Hono } from 'hono'

/** GET /api/health（疎通確認・認証不要）。 */
export const registerHealthRoutes = (app: Hono): void => {
  app.get('/api/health', (c) => c.json({ status: 'ok' }))
}
