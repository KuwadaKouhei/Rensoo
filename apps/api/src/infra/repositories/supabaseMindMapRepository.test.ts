import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SaveMindMapInput } from '@rensoo/shared'
import { SupabaseMindMapRepository } from './supabaseMindMapRepository'

// Supabase の query builder を必要な呼び出しだけ模した fake。最後の操作とペイロードを記録する。
interface FakeResult {
  data?: unknown
  error?: { message: string } | null
}

const createFakeClient = (results: {
  order?: FakeResult
  maybeSingle?: FakeResult
  single?: FakeResult
  delete?: FakeResult
}) => {
  const calls: { op?: string; table?: string; payload?: unknown; eqId?: string } = {}

  const builder = {
    select: () => builder,
    eq: (_col: string, val: string) => {
      calls.eqId = val
      return builder
    },
    order: async () => results.order ?? { data: [], error: null },
    maybeSingle: async () => results.maybeSingle ?? { data: null, error: null },
    single: async () => results.single ?? { data: null, error: null },
    insert: (payload: unknown) => {
      calls.op = 'insert'
      calls.payload = payload
      return builder
    },
    update: (payload: unknown) => {
      calls.op = 'update'
      calls.payload = payload
      return builder
    },
    delete: () => {
      calls.op = 'delete'
      return {
        eq: async (_col: string, val: string) => {
          calls.eqId = val
          return results.delete ?? { error: null }
        },
      }
    },
  }

  const client = {
    from: (table: string) => {
      calls.table = table
      return builder
    },
  } as unknown as SupabaseClient

  return { client, calls }
}

const input = (over: Partial<SaveMindMapInput> = {}): SaveMindMapInput => ({
  title: '宇宙の連想',
  nodes: [
    { id: 'n1', text: '宇宙', depth: 0, origin: 'root' },
    { id: 'n2', text: '銀河', depth: 1, origin: 'auto' },
  ],
  edges: [{ id: 'n1->n2', source: 'n1', target: 'n2' }],
  settings: { countPerNode: 6, maxDepth: 3, maxNodes: 50 },
  ...over,
})

describe('SupabaseMindMapRepository', () => {
  it('list は行を MindMapSummary にマップする', async () => {
    const { client } = createFakeClient({
      order: {
        data: [{ id: 'm1', title: 'A', updated_at: '2026-06-30T00:00:00Z' }],
        error: null,
      },
    })
    const repo = new SupabaseMindMapRepository(client)
    const result = await repo.list('userA')
    expect(result).toEqual([{ id: 'm1', title: 'A', updatedAt: '2026-06-30T00:00:00Z' }])
  })

  it('get は snapshot 行を MindMapSnapshot にマップし、無ければ null', async () => {
    const { client } = createFakeClient({
      maybeSingle: {
        data: {
          id: 'm1',
          title: 'A',
          settings: { countPerNode: 6, maxDepth: 3, maxNodes: 50 },
          snapshot: { nodes: [{ id: 'n1', text: '宇宙', depth: 0, origin: 'root' }], edges: [] },
        },
        error: null,
      },
    })
    const repo = new SupabaseMindMapRepository(client)
    const map = await repo.get('userA', 'm1')
    expect(map?.nodes).toHaveLength(1)
    expect(map?.title).toBe('A')

    const { client: empty } = createFakeClient({ maybeSingle: { data: null, error: null } })
    expect(await new SupabaseMindMapRepository(empty).get('userA', 'zzz')).toBeNull()
  })

  it('save（id なし）は insert で owner_id と root_keyword を設定する', async () => {
    const { client, calls } = createFakeClient({
      single: { data: { id: 'new1', title: '宇宙の連想', updated_at: 't' }, error: null },
    })
    const repo = new SupabaseMindMapRepository(client)
    const summary = await repo.save('userA', input())
    expect(calls.op).toBe('insert')
    const payload = calls.payload as { owner_id: string; root_keyword: string }
    expect(payload.owner_id).toBe('userA')
    expect(payload.root_keyword).toBe('宇宙') // 起点ノードのテキスト
    expect(summary).toEqual({ id: 'new1', title: '宇宙の連想', updatedAt: 't' })
  })

  it('save（id あり）は update で対象 id を指定する', async () => {
    const { client, calls } = createFakeClient({
      single: { data: { id: 'm1', title: '改題', updated_at: 't' }, error: null },
    })
    const repo = new SupabaseMindMapRepository(client)
    await repo.save('userA', input({ id: 'm1', title: '改題' }))
    expect(calls.op).toBe('update')
    expect(calls.eqId).toBe('m1')
  })

  it('DB エラーは握りつぶさず throw する', async () => {
    const { client } = createFakeClient({ order: { data: null, error: { message: 'boom' } } })
    const repo = new SupabaseMindMapRepository(client)
    await expect(repo.list('userA')).rejects.toThrow('一覧の取得に失敗')
  })

  it('remove は対象 id で delete する', async () => {
    const { client, calls } = createFakeClient({ delete: { error: null } })
    const repo = new SupabaseMindMapRepository(client)
    await repo.remove('userA', 'm1')
    expect(calls.op).toBe('delete')
    expect(calls.eqId).toBe('m1')
  })
})
