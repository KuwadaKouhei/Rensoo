import { beforeEach, describe, expect, it } from 'vitest'
import {
  addChildNode,
  appendAssociations,
  applyBatch,
  createRootMap,
  editNodeText,
  removeNodeCascade,
  useMindMapStore,
  type MapData,
} from './mindMapStore'

/** 検証用: 全エッジの source/target がノードに存在する（＝孤立エッジが無い）か。 */
const hasNoOrphanEdges = (data: MapData): boolean => {
  const ids = new Set(data.nodes.map((n) => n.id))
  return data.edges.every((e) => ids.has(e.source) && ids.has(e.target))
}

/** 起点→子2→孫1 のツリー（n1→n2,n3 / n2→n4）。 */
const buildTree = (): MapData => {
  let map = createRootMap('宇宙') // n1
  map = appendAssociations(map, 'n1', [{ word: '銀河' }, { word: '惑星' }]) // n2, n3
  map = appendAssociations(map, 'n2', [{ word: '恒星' }]) // n4
  return map
}

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

describe('addChildNode（手動追加・FR-15）', () => {
  it('親に手動ノード（origin=manual）と親→子エッジを追加する', () => {
    const next = addChildNode(buildTree(), 'n1', '人工衛星')
    const added = next.nodes.at(-1)
    expect(added).toMatchObject({ text: '人工衛星', depth: 1, origin: 'manual' })
    expect(next.edges.some((e) => e.source === 'n1' && e.target === added?.id)).toBe(true)
    expect(hasNoOrphanEdges(next)).toBe(true)
  })

  it('既存 id と衝突しない新 id を採番する', () => {
    // seq が古く n2 と衝突しうる状況でも衝突しない。
    const base: MapData = {
      nodes: [
        { id: 'n1', text: '宇宙', depth: 0, origin: 'root' },
        { id: 'n2', text: '銀河', depth: 1, origin: 'auto' },
      ],
      edges: [{ id: 'n1->n2', source: 'n1', target: 'n2' }],
      seq: 0,
    }
    const next = addChildNode(base, 'n1', '惑星')
    const ids = next.nodes.map((n) => n.id)
    expect(new Set(ids).size).toBe(ids.length) // id 重複なし
  })

  it('親が無ければ throw、空テキストも throw', () => {
    expect(() => addChildNode(buildTree(), 'n999', 'x')).toThrow('親ノードが見つかりません')
    expect(() => addChildNode(buildTree(), 'n1', '   ')).toThrow('テキストが空')
  })
})

describe('editNodeText（編集・FR-16）', () => {
  it('指定ノードのテキストだけを更新する', () => {
    const next = editNodeText(buildTree(), 'n2', '銀河系')
    expect(next.nodes.find((n) => n.id === 'n2')?.text).toBe('銀河系')
    expect(next.edges).toEqual(buildTree().edges) // エッジは不変
  })

  it('空テキスト・未知ノードは throw', () => {
    expect(() => editNodeText(buildTree(), 'n2', '  ')).toThrow('テキストが空')
    expect(() => editNodeText(buildTree(), 'zzz', 'x')).toThrow('ノードが見つかりません')
  })
})

describe('removeNodeCascade（削除・FR-17/AC-7）', () => {
  it('葉ノード削除で接続エッジも消え、孤立エッジが残らない', () => {
    const next = removeNodeCascade(buildTree(), 'n4')
    expect(next.nodes.map((n) => n.id)).toEqual(['n1', 'n2', 'n3'])
    expect(next.edges.some((e) => e.target === 'n4')).toBe(false)
    expect(hasNoOrphanEdges(next)).toBe(true)
  })

  it('中間ノード削除で子孫もまとめて消える（孤立ノード・孤立エッジを残さない）', () => {
    const next = removeNodeCascade(buildTree(), 'n2') // n2 と子孫 n4 を削除
    expect(next.nodes.map((n) => n.id).sort()).toEqual(['n1', 'n3'])
    expect(next.edges).toEqual([{ id: 'n1->n3', source: 'n1', target: 'n3' }])
    expect(hasNoOrphanEdges(next)).toBe(true)
  })

  it('起点ノード削除で全ノード・全エッジが消える', () => {
    const next = removeNodeCascade(buildTree(), 'n1')
    expect(next.nodes).toEqual([])
    expect(next.edges).toEqual([])
  })

  it('未知ノードの削除は何もしない', () => {
    const tree = buildTree()
    expect(removeNodeCascade(tree, 'zzz')).toEqual(tree)
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

  it('setError の retryable が反映される（既定 true / 明示 false）', () => {
    useMindMapStore.getState().setError('一時的な失敗')
    expect(useMindMapStore.getState().errorRetryable).toBe(true)

    useMindMapStore.getState().setError('恒久的な失敗', false)
    expect(useMindMapStore.getState().errorRetryable).toBe(false)
  })

  it('addChildNode / editNode / removeNode がストアに反映される', () => {
    const store = useMindMapStore.getState()
    store.startNewMap('宇宙') // n1
    store.addChildNode('n1', '銀河')
    let s = useMindMapStore.getState()
    const childId = s.nodes[1]?.id
    expect(s.nodes.map((n) => n.text)).toEqual(['宇宙', '銀河'])

    store.editNode(childId!, '銀河系')
    expect(useMindMapStore.getState().nodes[1]?.text).toBe('銀河系')

    store.removeNode(childId!)
    s = useMindMapStore.getState()
    expect(s.nodes.map((n) => n.text)).toEqual(['宇宙'])
    expect(s.edges).toEqual([])
  })

  it('選択中ノードを削除すると選択が解除される', () => {
    const store = useMindMapStore.getState()
    store.startNewMap('宇宙')
    store.addChildNode('n1', '銀河')
    const childId = useMindMapStore.getState().nodes[1]?.id ?? ''
    store.selectNode(childId)
    expect(useMindMapStore.getState().selectedNodeId).toBe(childId)

    store.removeNode(childId)
    expect(useMindMapStore.getState().selectedNodeId).toBeNull()
  })

  it('別ノード削除では選択は保持される', () => {
    const store = useMindMapStore.getState()
    store.startNewMap('宇宙')
    store.addChildNode('n1', '銀河')
    store.addChildNode('n1', '惑星')
    const [, a, b] = useMindMapStore.getState().nodes
    store.selectNode(a!.id)
    store.removeNode(b!.id)
    expect(useMindMapStore.getState().selectedNodeId).toBe(a!.id)
  })
})
