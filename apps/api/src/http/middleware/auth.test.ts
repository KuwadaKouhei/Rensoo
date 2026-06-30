import { describe, expect, it, beforeAll, vi } from 'vitest'
import { Hono } from 'hono'
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet, type JWK } from 'jose'
import {
  optionalAuth,
  requireAuth,
  verifierFromKeySet,
  type AuthEnv,
  type JwtVerifier,
} from './auth'

// ── 実 ES256 検証（jose ローカル鍵セット）で正常/期限切れ/改竄/sub欠落を検証する ──
const ISSUER = 'https://example.supabase.co/auth/v1'
const AUDIENCE = 'authenticated'

let verify: JwtVerifier
let signValid: (over?: { exp?: number; sub?: string }) => Promise<string>
let otherKeyToken: string

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair('ES256')
  const publicJwk: JWK = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'ES256' }
  const keySet = createLocalJWKSet({ keys: [publicJwk] })
  verify = verifierFromKeySet(keySet, { issuer: ISSUER, audience: AUDIENCE })

  signValid = (over) =>
    new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject(over?.sub ?? 'user-123')
      .setIssuedAt()
      .setExpirationTime(over?.exp ?? '2h')
      .sign(privateKey)

  // 別の鍵で署名したトークン（改竄/未知鍵相当）。
  const other = await generateKeyPair('ES256')
  otherKeyToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject('attacker')
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(other.privateKey)
})

describe('verifierFromKeySet（ES256 実検証）', () => {
  it('正常な JWT から sub を取り出す', async () => {
    const token = await signValid()
    await expect(verify(token)).resolves.toEqual({ sub: 'user-123' })
  })

  it('期限切れ JWT は throw する', async () => {
    const expired = await signValid({ exp: Math.floor(Date.now() / 1000) - 10 })
    await expect(verify(expired)).rejects.toBeTruthy()
  })

  it('別鍵で署名された JWT（改竄/未知鍵）は throw する', async () => {
    await expect(verify(otherKeyToken)).rejects.toBeTruthy()
  })

  it('sub の無い JWT は throw する', async () => {
    const noSub = await signValid({ sub: '' })
    await expect(verify(noSub)).rejects.toBeTruthy()
  })
})

// ── ミドルウェアの分類（欠落/無効/正常 × 必須/任意）──
const stubVerifier =
  (impl: (token: string) => Promise<{ sub: string }>): JwtVerifier =>
  (token) =>
    impl(token)

const okVerifier = stubVerifier(async () => ({ sub: 'user-1' }))
const failVerifier = stubVerifier(async () => {
  throw new Error('invalid')
})

const buildApp = (mw: ReturnType<typeof requireAuth>) => {
  const app = new Hono<AuthEnv>()
  app.use('/protected', mw)
  app.get('/protected', (c) => c.json({ userId: c.get('userId') ?? null }))
  return app
}

describe('requireAuth（必須認証）', () => {
  it('トークン欠落は 401 UNAUTHORIZED（日本語）', async () => {
    const res = await buildApp(requireAuth(okVerifier)).request('/protected')
    expect(res.status).toBe(401)
    const json = (await res.json()) as { error: { code: string; message: string } }
    expect(json.error.code).toBe('UNAUTHORIZED')
    expect(json.error.message).toContain('ログイン')
  })

  it('無効トークンは 401', async () => {
    const res = await buildApp(requireAuth(failVerifier)).request('/protected', {
      headers: { authorization: 'Bearer bad' },
    })
    expect(res.status).toBe(401)
  })

  it('有効トークンは通過し userId を載せる', async () => {
    const res = await buildApp(requireAuth(okVerifier)).request('/protected', {
      headers: { authorization: 'Bearer good' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: 'user-1' })
  })
})

describe('optionalAuth（任意認証・AC-8）', () => {
  it('トークン欠落でもゲストとして通過（userId なし）', async () => {
    const res = await buildApp(optionalAuth(okVerifier)).request('/protected')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: null })
  })

  it('無効トークンでもゲストとして通過する（生成を壊さない）', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await buildApp(optionalAuth(failVerifier)).request('/protected', {
      headers: { authorization: 'Bearer bad' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: null })
    expect(warn).toHaveBeenCalled()
  })

  it('有効トークンなら userId を載せる', async () => {
    const res = await buildApp(optionalAuth(okVerifier)).request('/protected', {
      headers: { authorization: 'Bearer good' },
    })
    expect(await res.json()).toEqual({ userId: 'user-1' })
  })
})
