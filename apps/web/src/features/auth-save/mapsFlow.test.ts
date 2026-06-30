import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapSummary, SaveMapRequest, SavedMap } from '@rensoo/shared'
import { ApiError } from '../../api-client/errors'
import { useMindMapStore } from '../../store/mindMapStore'
import { deleteMapById, fetchMapList, openMap, saveCurrentMap } from './mapsFlow'

// 保存導線の統合テスト。ストアは実物、API クライアントとトークン取得をスタブ（TEST_PHILOSOPHY）。
beforeEach(() => {
  useMindMapStore.getState().reset()
})

const summary: MapSummary = { id: 'map-1', title: '宇宙の連想', updatedAt: '2026-06-30T00:00:00Z' }

const savedMap: SavedMap = {
  id: 'map-1',
  title: '宇宙の連想',
  nodes: [
    { id: 'n1', text: '宇宙', depth: 0, origin: 'root' },
    { id: 'n2', text: '銀河', depth: 1, origin: 'auto' },
  ],
  edges: [{ id: 'n1->n2', source: 'n1', target: 'n2' }],
  settings: { countPerNode: 6, maxDepth: 3, maxNodes: 50 },
}

const makeClient = () => ({
  listMaps: vi.fn(async (_t: string) => [summary] as readonly MapSummary[]),
  getMap: vi.fn(async (_t: string, _id: string) => savedMap),
  saveMap: vi.fn(async (_t: string, _i: SaveMapRequest) => summary),
  deleteMap: vi.fn(async (_t: string, _id: string) => {}),
})

/** 起点＋子をストアに用意する（保存対象を作る）。 */
const seedMap = (): void => {
  const store = useMindMapStore.getState()
  store.startNewMap('宇宙')
  store.appendChildren('n1', [{ word: '銀河' }])
  store.setTitle('宇宙の連想')
}

describe('saveCurrentMap', () => {
  it('未ログインなら保存せず login-required を返す（AC-9）', async () => {
    seedMap()
    const client = makeClient()
    const result = await saveCurrentMap({ client, getToken: async () => null })
    expect(result).toEqual({ ok: false, reason: 'login-required' })
    expect(client.saveMap).not.toHaveBeenCalled()
  })

  it('ログイン済みなら現在のマップを保存し mapId を確定する（AC-10）', async () => {
    seedMap()
    const client = makeClient()
    const result = await saveCurrentMap({ client, getToken: async () => 'token' })

    expect(result.ok).toBe(true)
    expect(client.saveMap).toHaveBeenCalledTimes(1)
    const [, input] = client.saveMap.mock.calls[0]!
    expect(input.title).toBe('宇宙の連想')
    expect(input.id).toBeUndefined() // 新規
    expect(input.nodes).toHaveLength(2)
    expect(useMindMapStore.getState().mapId).toBe('map-1') // 以後は上書き
  })

  it('2回目の保存は確定済み mapId で上書きする', async () => {
    seedMap()
    const client = makeClient()
    await saveCurrentMap({ client, getToken: async () => 'token' })
    await saveCurrentMap({ client, getToken: async () => 'token' })
    const [, secondInput] = client.saveMap.mock.calls[1]!
    expect(secondInput.id).toBe('map-1')
  })

  it('空マップは保存しない', async () => {
    const client = makeClient()
    const result = await saveCurrentMap({ client, getToken: async () => 'token' })
    expect(result).toMatchObject({ ok: false, reason: 'error' })
    expect(client.saveMap).not.toHaveBeenCalled()
  })

  it('API 失敗は日本語メッセージで error を返す', async () => {
    seedMap()
    const client = {
      ...makeClient(),
      saveMap: vi.fn(async () => {
        throw new ApiError('混雑しています。', 'RATE_LIMITED', true, 429)
      }),
    }
    const result = await saveCurrentMap({ client, getToken: async () => 'token' })
    expect(result).toEqual({ ok: false, reason: 'error', message: '混雑しています。' })
  })
})

describe('fetchMapList', () => {
  it('未ログインは空配列', async () => {
    expect(await fetchMapList({ client: makeClient(), getToken: async () => null })).toEqual([])
  })

  it('ログイン済みは一覧を返す（AC-10）', async () => {
    const list = await fetchMapList({ client: makeClient(), getToken: async () => 'token' })
    expect(list).toEqual([summary])
  })
})

describe('openMap', () => {
  it('取得したマップをストアへ読み込み再編集状態にする（AC-10）', async () => {
    const ok = await openMap('map-1', { client: makeClient(), getToken: async () => 'token' })
    expect(ok).toBe(true)
    const s = useMindMapStore.getState()
    expect(s.mapId).toBe('map-1')
    expect(s.title).toBe('宇宙の連想')
    expect(s.nodes.map((n) => n.text)).toEqual(['宇宙', '銀河'])
  })

  it('404（他人/不存在）は false でエラー表示（AC-11 のフロント側）', async () => {
    const client = {
      ...makeClient(),
      getMap: vi.fn(async () => {
        throw new ApiError('マップが見つかりません。', 'NOT_FOUND', false, 404)
      }),
    }
    const ok = await openMap('other', { client, getToken: async () => 'token' })
    expect(ok).toBe(false)
    expect(useMindMapStore.getState().status).toBe('error')
  })
})

describe('deleteMapById', () => {
  it('削除に成功し、開いていたマップなら mapId を解除する', async () => {
    const ok = await openMap('map-1', { client: makeClient(), getToken: async () => 'token' })
    expect(ok).toBe(true)
    const client = makeClient()
    const deleted = await deleteMapById('map-1', { client, getToken: async () => 'token' })
    expect(deleted).toBe(true)
    expect(client.deleteMap).toHaveBeenCalledWith('token', 'map-1')
    expect(useMindMapStore.getState().mapId).toBeNull()
  })

  it('未ログインは削除しない', async () => {
    const client = makeClient()
    expect(await deleteMapById('map-1', { client, getToken: async () => null })).toBe(false)
    expect(client.deleteMap).not.toHaveBeenCalled()
  })
})
