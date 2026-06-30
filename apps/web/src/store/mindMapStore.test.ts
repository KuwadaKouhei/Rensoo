import { beforeEach, describe, expect, it } from 'vitest'
import {
  appendAssociations,
  applyBatch,
  createRootMap,
  useMindMapStore,
  type MapData,
} from './mindMapStore'

// 純粋関数（createRootMap / appendAssociations）= フロントのドメイン中核。モックなしで検証する。
describe('createRootMap', () => {
  it('起点キーワードから root ノード1つのマップを作る（depth=0 / origin=root）', () => {
    const map = createRootMap('宇宙')
    expect(map.nodes).toEqual([{ id: 'n1', text: '宇宙', depth: 0, origin: 'root' }])
    expect(map.edges).toEqual([])
    expect(map.seq).toBe(1)
  })

  it('前後の空白はトリムする', () => {
    expect(createRootMap('  宇宙  ').nodes[0]?.text).toBe('宇宙')
  })

  it('空キーワードは握りつぶさず throw する', () => {
    expect(() => createRootMap('   ')).toThrow('起点キーワードが空です')
  })
})

describe('appendAssociations', () => {
  const root = (): MapData => createRootMap('宇宙')

  it('連想語を子ノード＋親→子エッジとして取り込む（depth+1 / origin=auto）', () => {
    const next = appendAssociations(root(), 'n1', [{ word: '銀河' }, { word: '惑星' }])

    expect(next.nodes).toEqual([
      { id: 'n1', text: '宇宙', depth: 0, origin: 'root' },
      { id: 'n2', text: '銀河', depth: 1, origin: 'auto' },
      { id: 'n3', text: '惑星', depth: 1, origin: 'auto' },
    ])
    expect(next.edges).toEqual([
      { id: 'n1->n2', source: 'n1', target: 'n2' },
      { id: 'n1->n3', source: 'n1', target: 'n3' },
    ])
  })

  it('既存ノードと同テキスト・空白語は取り込まない（重複ノード抑止）', () => {
    const next = appendAssociations(root(), 'n1', [
      { word: '宇宙' }, // 既存の起点と重複 → 除外
      { word: '銀河' },
      { word: '銀河' }, // 同バッチ内の重複 → 除外
      { word: '   ' }, // 空白 → 除外
    ])
    expect(next.nodes.map((n) => n.text)).toEqual(['宇宙', '銀河'])
    expect(next.edges).toEqual([{ id: 'n1->n2', source: 'n1', target: 'n2' }])
  })

  it('存在しない親を指定すると throw する（孤立エッジを作らない・AC-7）', () => {
    expect(() => appendAssociations(root(), 'n999', [{ word: '銀河' }])).toThrow(
      '親ノードが見つかりません: n999',
    )
  })

  it('孫世代は親の depth に応じて深くなる', () => {
    const gen1 = appendAssociations(root(), 'n1', [{ word: '銀河' }])
    const gen2 = appendAssociations(gen1, 'n2', [{ word: '恒星' }])
    expect(gen2.nodes.find((n) => n.text === '恒星')?.depth).toBe(2)
  })
})

describe('applyBatch（SSE バッチ取り込み・サーバー採番 id）', () => {
  const empty = (): MapData => ({ nodes: [], edges: [], seq: 0 })

  it('起点バッチ（parentId=null）はマップを置き換え root を作る', () => {
    const next = applyBatch(empty(), {
      parentId: null,
      depth: 0,
      nodes: [{ id: 'n1', text: '宇宙' }],
    })
    expect(next.nodes).toEqual([{ id: 'n1', text: '宇宙', depth: 0, origin: 'root' }])
    expect(next.edges).toEqual([])
  })

  it('子バッチは未知 id を追加し親→子エッジを張る（depth・origin=auto）', () => {
    const root = applyBatch(empty(), {
      parentId: null,
      depth: 0,
      nodes: [{ id: 'n1', text: '宇宙' }],
    })
    const next = applyBatch(root, {
      parentId: 'n1',
      depth: 1,
      nodes: [
        { id: 'n2', text: '銀河' },
        { id: 'n3', text: '惑星' },
      ],
    })
    expect(next.nodes.slice(1)).toEqual([
      { id: 'n2', text: '銀河', depth: 1, origin: 'auto' },
      { id: 'n3', text: '惑星', depth: 1, origin: 'auto' },
    ])
    expect(next.edges).toEqual([
      { id: 'n1->n2', source: 'n1', target: 'n2' },
      { id: 'n1->n3', source: 'n1', target: 'n3' },
    ])
  })

  it('同じ id の再到着は無視する（冪等）', () => {
    const root = applyBatch(empty(), {
      parentId: null,
      depth: 0,
      nodes: [{ id: 'n1', text: '宇宙' }],
    })
    const once = applyBatch(root, { parentId: 'n1', depth: 1, nodes: [{ id: 'n2', text: '銀河' }] })
    const twice = applyBatch(once, {
      parentId: 'n1',
      depth: 1,
      nodes: [{ id: 'n2', text: '銀河' }],
    })
    expect(twice.nodes).toHaveLength(2)
    expect(twice.edges).toHaveLength(1)
  })
})

describe('useMindMapStore', () => {
  beforeEach(() => {
    useMindMapStore.getState().reset()
  })

  it('初期状態は空・自動モード・idle・既定設定', () => {
    const s = useMindMapStore.getState()
    expect(s.nodes).toEqual([])
    expect(s.mode).toBe('auto')
    expect(s.status).toBe('idle')
    expect(s.settings).toEqual({ countPerNode: 6, maxDepth: 3, maxNodes: 50 })
  })

  it('startNewMap → appendChildren で状態が積み上がる', () => {
    const store = useMindMapStore.getState()
    store.startNewMap('宇宙')
    store.appendChildren('n1', [{ word: '銀河' }])
    const s = useMindMapStore.getState()
    expect(s.nodes.map((n) => n.text)).toEqual(['宇宙', '銀河'])
    expect(s.edges).toEqual([{ id: 'n1->n2', source: 'n1', target: 'n2' }])
  })

  it('setError は status=error にしメッセージを保持、setStatus(generating) でクリア', () => {
    const store = useMindMapStore.getState()
    store.setError('失敗しました')
    expect(useMindMapStore.getState().status).toBe('error')
    expect(useMindMapStore.getState().errorMessage).toBe('失敗しました')

    store.setStatus('generating')
    expect(useMindMapStore.getState().status).toBe('generating')
    expect(useMindMapStore.getState().errorMessage).toBeNull()
  })

  it('setMode / updateSettings が反映される', () => {
    const store = useMindMapStore.getState()
    store.setMode('manual')
    store.updateSettings({ countPerNode: 8 })
    const s = useMindMapStore.getState()
    expect(s.mode).toBe('manual')
    expect(s.settings.countPerNode).toBe(8)
    expect(s.settings.maxDepth).toBe(3)
  })

  it('applyExpansionBatch でストアに root→子が積み上がる', () => {
    const store = useMindMapStore.getState()
    store.applyExpansionBatch({ parentId: null, depth: 0, nodes: [{ id: 'n1', text: '宇宙' }] })
    store.applyExpansionBatch({ parentId: 'n1', depth: 1, nodes: [{ id: 'n2', text: '銀河' }] })
    const s = useMindMapStore.getState()
    expect(s.nodes.map((n) => n.text)).toEqual(['宇宙', '銀河'])
    expect(s.edges).toEqual([{ id: 'n1->n2', source: 'n1', target: 'n2' }])
  })

  it('clearMap はマップと停止理由を消すが設定・モードは保持する', () => {
    const store = useMindMapStore.getState()
    store.setMode('manual')
    store.updateSettings({ countPerNode: 9 })
    store.applyExpansionBatch({ parentId: null, depth: 0, nodes: [{ id: 'n1', text: '宇宙' }] })
    store.setStopReason('max_nodes')

    store.clearMap()
    const s = useMindMapStore.getState()
    expect(s.nodes).toEqual([])
    expect(s.stopReason).toBeNull()
    expect(s.mode).toBe('manual') // 保持
    expect(s.settings.countPerNode).toBe(9) // 保持
  })

  it('setStopReason が反映される', () => {
    useMindMapStore.getState().setStopReason('max_depth')
    expect(useMindMapStore.getState().stopReason).toBe('max_depth')
  })
})
