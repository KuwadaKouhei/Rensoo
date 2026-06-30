import { beforeEach, describe, expect, it } from 'vitest'
import type {
  MindMapRepository,
  MindMapSnapshot,
  MindMapSummary,
  SaveMindMapInput,
} from '@rensoo/shared'
import { createApp } from '../app'
import { AppError } from '../errorResponses'
import type { JwtVerifier } from '../middleware/auth'
import type { MindMapRepositoryFactory } from '../../infra/repositories/supabaseMindMapRepository'

// トークン→userId のスタブ検証（tokenA→A, tokenB→B で2ユーザーを模す）。
const stubVerifier: JwtVerifier = async (token) => {
  if (token === 'tokenA') return { sub: 'userA' }
  if (token === 'tokenB') return { sub: 'userB' }
  throw new Error('invalid token')
}

interface StoredMap extends MindMapSnapshot {
  owner: string
}

/** RLS を模した共有インメモリ Repository（各操作を userId で本人限定）。 */
const createInMemoryRepo = () => {
  const store = new Map<string, StoredMap>()
  let seq = 0
  const repo: MindMapRepository = {
    list: async (userId) =>
      [...store.values()]
        .filter((m) => m.owner === userId)
        .map<MindMapSummary>((m) => ({
          id: m.id,
          title: m.title,
          updatedAt: '2026-06-30T00:00:00Z',
        })),
    get: async (userId, mapId) => {
      const m = store.get(mapId)
      if (!m || m.owner !== userId) return null
      const { owner, ...snapshot } = m
      return snapshot
    },
    save: async (userId, input: SaveMindMapInput) => {
      if (input.id) {
        // 上書き: 本人の既存マップのみ。他人/不存在は RLS で 0 行＝NOT_FOUND（実 repo と同挙動）。
        const existing = store.get(input.id)
        if (!existing || existing.owner !== userId) {
          throw new AppError('NOT_FOUND', 'マップが見つかりません。')
        }
        store.set(input.id, {
          owner: userId,
          id: input.id,
          title: input.title,
          nodes: input.nodes,
          edges: input.edges,
          settings: input.settings,
        })
        return { id: input.id, title: input.title, updatedAt: '2026-06-30T00:00:00Z' }
      }
      const id = `map-${(seq += 1)}`
      store.set(id, {
        owner: userId,
        id,
        title: input.title,
        nodes: input.nodes,
        edges: input.edges,
        settings: input.settings,
      })
      return { id, title: input.title, updatedAt: '2026-06-30T00:00:00Z' }
    },
    remove: async (userId, mapId) => {
      const m = store.get(mapId)
      if (m && m.owner === userId) store.delete(mapId) // 他人の行は RLS で0行＝削除されない。
    },
  }
  const factory: MindMapRepositoryFactory = { forUser: () => repo }
  return { factory, store }
}

const settings = { countPerNode: 6, maxDepth: 3, maxNodes: 50 }
const sampleBody = (over: Record<string, unknown> = {}) => ({
  title: '宇宙の連想',
  nodes: [
    { id: 'n1', text: '宇宙', depth: 0, origin: 'root' },
    { id: 'n2', text: '銀河', depth: 1, origin: 'auto' },
  ],
  edges: [{ id: 'n1->n2', source: 'n1', target: 'n2' }],
  settings,
  ...over,
})

let app: ReturnType<typeof createApp>

beforeEach(() => {
  const { factory } = createInMemoryRepo()
  app = createApp({
    associationProvider: { associate: async () => ({ words: [], meta: {} }) },
    jwtVerifier: stubVerifier,
    repositoryFactory: factory,
  })
})

const authed = (token: string, path: string, init: RequestInit = {}) =>
  app.request(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...init.headers,
    },
  })

describe('保存系 maps API（認証必須・RLS 模擬）', () => {
  it('認証なしは 401（保存系は必須）', async () => {
    const res = await app.request('/api/maps')
    expect(res.status).toBe(401)
  })

  it('保存→一覧→取得で再編集できる（AC-10）', async () => {
    const saveRes = await authed('tokenA', '/api/maps', {
      method: 'POST',
      body: JSON.stringify(sampleBody()),
    })
    expect(saveRes.status).toBe(200)
    const summary = (await saveRes.json()) as { id: string; title: string }
    expect(summary.title).toBe('宇宙の連想')

    const listRes = await authed('tokenA', '/api/maps')
    const list = (await listRes.json()) as { maps: { id: string }[] }
    expect(list.maps.map((m) => m.id)).toContain(summary.id)

    const getRes = await authed('tokenA', `/api/maps/${summary.id}`)
    expect(getRes.status).toBe(200)
    const map = (await getRes.json()) as { nodes: unknown[]; edges: unknown[] }
    expect(map.nodes).toHaveLength(2)
    expect(map.edges).toHaveLength(1)
  })

  it('上書き保存（id 指定）でタイトルが更新される', async () => {
    const first = (await (
      await authed('tokenA', '/api/maps', { method: 'POST', body: JSON.stringify(sampleBody()) })
    ).json()) as { id: string }

    await authed('tokenA', '/api/maps', {
      method: 'POST',
      body: JSON.stringify(sampleBody({ id: first.id, title: '改題' })),
    })
    const map = (await (await authed('tokenA', `/api/maps/${first.id}`)).json()) as {
      title: string
    }
    expect(map.title).toBe('改題')
  })

  it('他人のマップは一覧に出ず、取得は 404（AC-11）', async () => {
    const a = (await (
      await authed('tokenA', '/api/maps', { method: 'POST', body: JSON.stringify(sampleBody()) })
    ).json()) as { id: string }

    const bList = (await (await authed('tokenB', '/api/maps')).json()) as { maps: unknown[] }
    expect(bList.maps).toEqual([]) // B には A のマップが見えない

    const bGet = await authed('tokenB', `/api/maps/${a.id}`)
    expect(bGet.status).toBe(404)
  })

  it('他人がマップを削除しようとしても残る（AC-11）', async () => {
    const a = (await (
      await authed('tokenA', '/api/maps', { method: 'POST', body: JSON.stringify(sampleBody()) })
    ).json()) as { id: string }

    const del = await authed('tokenB', `/api/maps/${a.id}`, { method: 'DELETE' })
    expect(del.status).toBe(204)

    // A からはまだ見える（B の削除は RLS で 0 行）。
    const aGet = await authed('tokenA', `/api/maps/${a.id}`)
    expect(aGet.status).toBe(200)
  })

  it('他人のマップ ID への上書き保存は 404（500 にしない・AC-11）', async () => {
    const a = (await (
      await authed('tokenA', '/api/maps', { method: 'POST', body: JSON.stringify(sampleBody()) })
    ).json()) as { id: string }

    const res = await authed('tokenB', '/api/maps', {
      method: 'POST',
      body: JSON.stringify(sampleBody({ id: a.id, title: '乗っ取り' })),
    })
    expect(res.status).toBe(404)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('孤立エッジを含む保存は 400 VALIDATION（AC-7 と整合）', async () => {
    const res = await authed('tokenA', '/api/maps', {
      method: 'POST',
      body: JSON.stringify(sampleBody({ edges: [{ id: 'x', source: 'n1', target: 'zzz' }] })),
    })
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('VALIDATION')
  })

  it('存在しないマップの取得は 404', async () => {
    const res = await authed('tokenA', '/api/maps/no-such-id')
    expect(res.status).toBe(404)
  })

  it('削除後は取得できない（204→404）', async () => {
    const a = (await (
      await authed('tokenA', '/api/maps', { method: 'POST', body: JSON.stringify(sampleBody()) })
    ).json()) as { id: string }

    const del = await authed('tokenA', `/api/maps/${a.id}`, { method: 'DELETE' })
    expect(del.status).toBe(204)
    const get = await authed('tokenA', `/api/maps/${a.id}`)
    expect(get.status).toBe(404)
  })
})
