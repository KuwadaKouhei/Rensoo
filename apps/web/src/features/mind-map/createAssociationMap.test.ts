import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssociateResponse } from '@rensoo/shared'
import { ApiError } from '../../api-client/errors'
import { useMindMapStore } from '../../store/mindMapStore'
import { createAssociationMap } from './createAssociationMap'

// 主要フロー（キーワード→生成→表示）の統合テスト。ストアは実物、API 境界のみスタブ（TEST_PHILOSOPHY）。
const okResponse = (words: string[]): AssociateResponse => ({
  words: words.map((word) => ({ word })),
  meta: { provider: 'claude', model: 'claude-haiku-4-5' },
})

beforeEach(() => {
  useMindMapStore.getState().reset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createAssociationMap', () => {
  it('作成で起点＋連想ノードが描画状態に入る（AC-1）', async () => {
    await createAssociationMap('宇宙', {
      requestAssociations: async () => okResponse(['銀河', '惑星', '星']),
    })

    const { nodes, edges, status } = useMindMapStore.getState()
    expect(nodes[0]).toMatchObject({ id: 'n1', text: '宇宙', depth: 0, origin: 'root' })
    expect(nodes.slice(1).map((n) => n.text)).toEqual(['銀河', '惑星', '星'])
    expect(edges).toHaveLength(3)
    expect(status).toBe('idle')
  })

  it('件数設定が次回生成の count に追従する（AC-2）', async () => {
    useMindMapStore.getState().updateSettings({ countPerNode: 4 })
    const spy = vi.fn(async () => okResponse(['a', 'b', 'c', 'd']))

    await createAssociationMap('宇宙', { requestAssociations: spy })

    expect(spy).toHaveBeenCalledWith({ input: '宇宙', count: 4 })
  })

  it('生成中は status=generating、完了で idle（ローディング表示の根拠）', async () => {
    let resolve: ((r: AssociateResponse) => void) | undefined
    const pending = new Promise<AssociateResponse>((r) => {
      resolve = r
    })

    const flow = createAssociationMap('宇宙', { requestAssociations: () => pending })
    // await 前に起点表示＋生成中になっている。
    expect(useMindMapStore.getState().status).toBe('generating')
    expect(useMindMapStore.getState().nodes[0]?.text).toBe('宇宙')

    resolve?.(okResponse(['銀河']))
    await flow
    expect(useMindMapStore.getState().status).toBe('idle')
    expect(useMindMapStore.getState().nodes.map((n) => n.text)).toEqual(['宇宙', '銀河'])
  })

  it('API 失敗は日本語メッセージで status=error（AC-12）', async () => {
    await createAssociationMap('宇宙', {
      requestAssociations: async () => {
        throw new ApiError(
          'リクエストが集中しています。しばらくして再試行してください。',
          'RATE_LIMITED',
          true,
          429,
        )
      },
    })

    const { status, errorMessage } = useMindMapStore.getState()
    expect(status).toBe('error')
    expect(errorMessage).toBe('リクエストが集中しています。しばらくして再試行してください。')
  })

  it('想定外エラーは汎用日本語メッセージにフォールバックしログする', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    await createAssociationMap('宇宙', {
      requestAssociations: async () => {
        throw new Error('boom')
      },
    })

    expect(useMindMapStore.getState().status).toBe('error')
    expect(useMindMapStore.getState().errorMessage).toContain('連想の生成に失敗しました')
    expect(errorLog).toHaveBeenCalled()
  })

  it('空キーワードは API を呼ばずエラー表示する', async () => {
    const spy = vi.fn(async () => okResponse(['x']))
    await createAssociationMap('   ', { requestAssociations: spy })

    expect(spy).not.toHaveBeenCalled()
    expect(useMindMapStore.getState().status).toBe('error')
    expect(useMindMapStore.getState().errorMessage).toBe('キーワードを入力してください。')
    expect(useMindMapStore.getState().nodes).toEqual([])
  })
})
