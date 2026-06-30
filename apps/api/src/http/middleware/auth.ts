// 認証ミドルウェア（DESIGN §7.1〜§7.4）。Supabase が発行する JWT を JWKS(ES256) でローカル検証し、
// `sub`(user_id) を Context に載せる。シークレット共有不要で別サーバー検証に適する（NFR-6）。
//
// 認可は二重化（CODING_PHILOSOPHY）: ここ（API 層）で user_id を確定し、最後の砦は DB の RLS。
// 生成系=任意（未認証可・AC-8）、保存系=必須（欠落/無効は 401 日本語・AC-9〜11 の土台）。

import type { MiddlewareHandler } from 'hono'
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import type { ErrorResponseBody } from '../errors.js'

/** Context 変数の型（保存系ハンドラが userId を読む）。 */
export type AuthEnv = { Variables: { userId?: string } }

/** 検証済みクレーム（必要最小限）。 */
export interface JwtClaims {
  readonly sub: string
}

/** JWT 検証関数（失敗時は throw）。テストでスタブ注入できるよう関数境界で抽象化する。 */
export type JwtVerifier = (token: string) => Promise<JwtClaims>

export interface VerifierOptions {
  /** 期待する issuer（例: `${SUPABASE_URL}/auth/v1`）。 */
  readonly issuer?: string
  /** 期待する audience（Supabase は通常 'authenticated'）。 */
  readonly audience?: string
}

/** jose の鍵セット取得関数から JWT 検証関数を作る（ローカル鍵セットでのテストにも使える）。 */
export const verifierFromKeySet = (
  keySet: JWTVerifyGetKey,
  options: VerifierOptions = {},
): JwtVerifier => {
  return async (token) => {
    const { payload } = await jwtVerify(token, keySet, {
      issuer: options.issuer,
      audience: options.audience,
    })
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('JWT に sub が含まれていません')
    }
    return { sub: payload.sub }
  }
}

/** Supabase の JWKS エンドポイントから公開鍵を取得・キャッシュする検証関数を作る（鍵ローテーション対応）。 */
export const createJwksVerifier = (params: {
  jwksUri: string
  issuer?: string
  audience?: string
}): JwtVerifier => {
  // createRemoteJWKSet は取得済み鍵をキャッシュし、未知 kid のとき再取得する（§7.4）。
  const keySet = createRemoteJWKSet(new URL(params.jwksUri))
  return verifierFromKeySet(keySet, { issuer: params.issuer, audience: params.audience })
}

/** Authorization: Bearer <token> からトークンを取り出す。 */
const extractBearer = (header: string | undefined): string | null => {
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? (match[1]?.trim() ?? null) : null
}

/** 401 応答（日本語・内部情報を含めない）。 */
const unauthorized = (message: string) =>
  ({ error: { code: 'UNAUTHORIZED', message, retryable: false } }) satisfies ErrorResponseBody

/**
 * 認証必須ミドルウェア（保存系・AC-9〜11）。
 * トークン欠落・検証失敗はいずれも 401（日本語）。成功時は userId を Context に載せる。
 */
export const requireAuth = (verify: JwtVerifier): MiddlewareHandler<AuthEnv> => {
  return async (c, next) => {
    const token = extractBearer(c.req.header('authorization'))
    if (!token) {
      return c.json(unauthorized('ログインが必要です。'), 401)
    }
    try {
      const claims = await verify(token)
      c.set('userId', claims.sub)
    } catch (err) {
      // 失敗理由（期限切れ/改竄等）はログのみ。ユーザーには一律 401。
      console.error('[auth] JWT 検証に失敗しました', err)
      return c.json(unauthorized('認証情報が無効です。再度ログインしてください。'), 401)
    }
    await next()
  }
}

/**
 * 認証任意ミドルウェア（生成系・AC-8）。
 * トークンが無ければゲストとして続行。トークンがあり有効なら userId を載せる。
 * **無効なトークンでもゲストとして続行**（生成のゲスト動作を壊さない）。ログには残す。
 */
export const optionalAuth = (verify: JwtVerifier): MiddlewareHandler<AuthEnv> => {
  return async (c, next) => {
    const token = extractBearer(c.req.header('authorization'))
    if (token) {
      try {
        const claims = await verify(token)
        c.set('userId', claims.sub)
      } catch (err) {
        // 生成系は未認証可。無効トークンはゲスト扱いで続行（握りつぶさずログ）。
        console.warn('[auth] 任意認証で無効なトークンを無視しました', err)
      }
    }
    await next()
  }
}
