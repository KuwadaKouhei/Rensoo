import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssociateResponse } from '@rensoo/shared'
import { ApiError } from '../../api-client/errors'
import { useMindMapStore } from '../../store/mindMapStore'
import { expandNode } from './expandNode'

// 手動展開フローの統合テスト。ストアは実物、API 境界のみスタブ（TEST_PHILOSOPHY）。
const okResponse = (words: string[]): AssociateResponse => ({
  words: words.map((word) => ({ word })),
  meta: { provider: 'claude' },
})

beforeEach(() => {
  useMindMapStore.getState().reset()
})

/** 手動モードで起点ノード1つを持つ状態を用意する。 */
const setupManualRoot = (): void => {
  const store = useMindMapStore.getState()
  store.setMode('manual')
  store.startNewMap('宇宙') // n1
}

describe('expandNode', () => {
  it('手動モードでクリックノードに子を1段だけ追加する（連鎖しない・AC-4）', async () => {
    setupManualRoot()
    const spy = vi.fn(async () => okResponse(['銀河', '惑星']))

    await expandNode('n1', { requestAssociations: spy })

    const s = useMindMapStore.getState()
    expect(s.nodes.map((n) => n.text)).toEqual(['宇宙', '銀河', '惑星'])
    expect(s.edges).toEqual([
      { id: 'n1->n2', source: 'n1', target: 'n2' },
      { id: 'n1->n3', source: 'n1', target: 'n3' },
    ])
    expect(s.status).toBe('idle')
    // 連鎖しない＝呼び出しは1回だけ。
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({ input: '宇宙', count: 6 })
  })

  it('子ノードをさらにクリックすると、その子の語で展開する', async () => {
    setupManualRoot()
    await expandNode('n1', { requestAssociations: async () => okResponse(['銀河']) }) // n2=銀河
    const spy = vi.fn(async () => okResponse(['恒星']))

    await expandNode('n2', { requestAssociations: spy })

    expect(spy).toHaveBeenCalledWith({ input: '銀河', count: 6 })
    const s = useMindMapStore.getState()
    expect(s.nodes.find((n) => n.text === '恒星')?.depth).toBe(2)
  })

  it('自動モードでは手動展開しない（no-op・AC-4/5）', async () => {
    const store = useMindMapStore.getState()
    store.setMode('auto')
    store.startNewMap('宇宙')
    const spy = vi.fn(async () => okResponse(['銀河']))

    await expandNode('n1', { requestAssociations: spy })

    expect(spy).not.toHaveBeenCalled()
    expect(useMindMapStore.getState().nodes).toHaveLength(1)
  })

  it('生成中は多重実行しない（no-op）', async () => {
    setupManualRoot()
    useMindMapStore.getState().setStatus('generating')
    const spy = vi.fn(async () => okResponse(['銀河']))

    await expandNode('n1', { requestAssociations: spy })

    expect(spy).not.toHaveBeenCalled()
  })

  it('存在しないノードは何もしない', async () => {
    setupManualRoot()
    const spy = vi.fn(async () => okResponse(['銀河']))
    await expandNode('n999', { requestAssociations: spy })
    expect(spy).not.toHaveBeenCalled()
  })

  it('API 失敗は日本語メッセージで status=error（AC-12）', async () => {
    setupManualRoot()
    await expandNode('n1', {
      requestAssociations: async () => {
        throw new ApiError('混雑しています。', 'RATE_LIMITED', true, 429)
      },
    })
    const s = useMindMapStore.getState()
    expect(s.status).toBe('error')
    expect(s.errorMessage).toBe('混雑しています。')
  })
})
