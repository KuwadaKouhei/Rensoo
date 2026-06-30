// 保存系エンドポイント（maps CRUD・すべて認証必須・DESIGN §5.2/§5.3・AC-9,10,11）。
// requireAuth で JWT を必須化し、ユーザー JWT を引き継いだ Repository で発行＝RLS で本人限定（二重化）。

import type { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { saveMapRequestSchema, type SaveMindMapInput } from '@rensoo/shared'
import type { ErrorResponseBody } from '../errors.js'
import { requireAuth, type AuthEnv, type JwtVerifier } from '../middleware/auth.js'
import type { MindMapRepositoryFactory } from '../../infra/repositories/supabaseMindMapRepository.js'

const notFound = (): ErrorResponseBody => ({
  error: { code: 'NOT_FOUND', message: 'マップが見つかりません。', retryable: false },
})

const validationError = (): ErrorResponseBody => ({
  error: {
    code: 'VALIDATION',
    message: '保存内容が正しくありません。入力を確認してください。',
    retryable: false,
  },
})

/**
 * 保存系ルートを登録する。requireAuth(verifier) で全エンドポイントを認証必須にし、
 * 検証済みトークンから RLS 引き継ぎ Repository を生成して操作する。
 */
export const registerMapsRoutes = (
  app: Hono<AuthEnv>,
  repositoryFactory: MindMapRepositoryFactory,
  verifier: JwtVerifier,
): void => {
  const auth = requireAuth(verifier)

  // 認証済みコンテキストから userId と JWT 引き継ぎ Repository を取り出す。
  const resolve = (c: { get: (k: 'userId' | 'token') => string | undefined }) => {
    const userId = c.get('userId')
    const token = c.get('token')
    // requireAuth 通過後は必ず存在するが、型のため明示チェック（握りつぶさない）。
    if (!userId || !token) {
      throw new Error('認証コンテキストが不正です')
    }
    return { userId, repo: repositoryFactory.forUser(token) }
  }

  // 一覧（AC-10）。
  app.get('/api/maps', auth, async (c) => {
    const { userId, repo } = resolve(c)
    const maps = await repo.list(userId)
    return c.json({ maps })
  })

  // 取得（本人のみ。他人のものは null→404・AC-11）。
  app.get('/api/maps/:id', auth, async (c) => {
    const { userId, repo } = resolve(c)
    const map = await repo.get(userId, c.req.param('id'))
    if (!map) {
      return c.json(notFound(), 404)
    }
    return c.json(map)
  })

  // 保存（新規/上書き・AC-9,10）。snapshot を Zod 検証（孤立エッジ禁止）。
  app.post(
    '/api/maps',
    auth,
    zValidator('json', saveMapRequestSchema, (result, c) => {
      if (!result.success) {
        return c.json(validationError(), 400)
      }
      return undefined
    }),
    async (c) => {
      const { userId, repo } = resolve(c)
      const body = c.req.valid('json')
      const input: SaveMindMapInput = {
        id: body.id,
        title: body.title,
        nodes: body.nodes,
        edges: body.edges,
        settings: body.settings,
      }
      const summary = await repo.save(userId, input)
      return c.json(summary)
    },
  )

  // 削除（本人のみ・AC-11）。
  app.delete('/api/maps/:id', auth, async (c) => {
    const { userId, repo } = resolve(c)
    await repo.remove(userId, c.req.param('id'))
    return c.body(null, 204)
  })
}
