import type { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  associateRequestSchema,
  normalizeAssociations,
  type AssociationProvider,
} from '@rensoo/shared'
import type { ErrorResponseBody } from '../errors.js'
import type { AuthEnv } from '../middleware/auth.js'

/**
 * POST /api/associations（単発の連想生成・認証任意・AC-1,2）。
 * 入力を Zod 検証 → Provider で生成 → normalizeAssociations で整形して返す。
 */
export const registerAssociationRoutes = (
  app: Hono<AuthEnv>,
  provider: AssociationProvider,
): void => {
  app.post(
    '/api/associations',
    zValidator('json', associateRequestSchema, (result, c) => {
      if (!result.success) {
        const body: ErrorResponseBody = {
          error: {
            code: 'VALIDATION',
            message: '入力が正しくありません。キーワードと件数を確認してください。',
            retryable: false,
          },
        }
        return c.json(body, 400)
      }
      // 成功時は何も返さず後続ハンドラへ進む。
      return undefined
    }),
    async (c) => {
      const { input, count, locale } = c.req.valid('json')
      const result = await provider.associate({ input, count, locale })
      const words = normalizeAssociations(result.words, { input, count })
      return c.json({ words, meta: result.meta })
    },
  )
}
