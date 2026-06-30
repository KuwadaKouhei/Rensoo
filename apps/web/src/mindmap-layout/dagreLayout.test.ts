import { describe, expect, it } from 'vitest'
import type { MindMapEdge, MindMapNode } from '@rensoo/shared'
import { dagreLayout } from './dagreLayout'
import type { LayoutInput } from './layout'

/** depth に応じた起点→子→孫の小さなツリーを作る。 */
const buildTree = (): LayoutInput => {
  const nodes: MindMapNode[] = [
    { id: 'n1', text: '宇宙', depth: 0, origin: 'root' },
    { id: 'n2', text: '銀河', depth: 1, origin: 'auto' },
    { id: 'n3', text: '惑星', depth: 1, origin: 'auto' },
    { id: 'n4', text: '恒星', depth: 2, origin: 'auto' },
  ]
  const edges: MindMapEdge[] = [
    { id: 'n1->n2', source: 'n1', target: 'n2' },
    { id: 'n1->n3', source: 'n1', target: 'n3' },
    { id: 'n2->n4', source: 'n2', target: 'n4' },
  ]
  return { nodes, edges }
}

describe('dagreLayout', () => {
  it('全ノードに座標を返す', () => {
    const positioned = dagreLayout(buildTree())
    expect(positioned.map((p) => p.id).sort()).toEqual(['n1', 'n2', 'n3', 'n4'])
    for (const p of positioned) {
      expect(Number.isFinite(p.position.x)).toBe(true)
      expect(Number.isFinite(p.position.y)).toBe(true)
    }
  })

  it('決定的: 同一入力なら毎回同一座標を返す', () => {
    const a = dagreLayout(buildTree())
    const b = dagreLayout(buildTree())
    expect(a).toEqual(b)
  })

  it('TB（既定）では親が子より上に配置される（親.y < 子.y）', () => {
    const positioned = dagreLayout(buildTree())
    const y = (id: string) => positioned.find((p) => p.id === id)!.position.y
    expect(y('n1')).toBeLessThan(y('n2'))
    expect(y('n1')).toBeLessThan(y('n3'))
    expect(y('n2')).toBeLessThan(y('n4')) // 孫はさらに下
  })

  it('LR では親が子より左に配置される（親.x < 子.x）', () => {
    const positioned = dagreLayout({ ...buildTree(), direction: 'LR' })
    const x = (id: string) => positioned.find((p) => p.id === id)!.position.x
    expect(x('n1')).toBeLessThan(x('n2'))
    expect(x('n2')).toBeLessThan(x('n4'))
  })

  it('数十ノード（星形）でも全ノードの座標が破綻なく返る', () => {
    const nodes: MindMapNode[] = [{ id: 'n1', text: '起点', depth: 0, origin: 'root' }]
    const edges: MindMapEdge[] = []
    for (let i = 2; i <= 40; i += 1) {
      nodes.push({ id: `n${i}`, text: `語${i}`, depth: 1, origin: 'auto' })
      edges.push({ id: `n1->n${i}`, source: 'n1', target: `n${i}` })
    }
    const positioned = dagreLayout({ nodes, edges })
    expect(positioned).toHaveLength(40)
    expect(new Set(positioned.map((p) => `${p.position.x},${p.position.y}`)).size).toBe(40) // 全て別座標
  })

  it('エッジが無くてもノード座標を返す（孤立した起点のみ）', () => {
    const positioned = dagreLayout({
      nodes: [{ id: 'n1', text: '宇宙', depth: 0, origin: 'root' }],
      edges: [],
    })
    expect(positioned).toHaveLength(1)
    expect(positioned[0]?.id).toBe('n1')
  })
})
