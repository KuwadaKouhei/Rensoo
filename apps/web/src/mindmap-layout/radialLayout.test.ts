// radialLayout の重点ユニット（決定性・放射関係・境界）。React Flow 非依存。
import { describe, expect, it } from 'vitest'
import type { MindMapEdge, MindMapNode } from '@rensoo/shared'
import { radialLayout } from './radialLayout'

const node = (id: string, depth: number): MindMapNode => ({
  id,
  text: id,
  depth,
  origin: depth === 0 ? 'root' : 'auto',
})
const edge = (source: string, target: string): MindMapEdge => ({ id: `${source}->${target}`, source, target })

/** 中心（0,0）からの距離。 */
const dist = (p: { x: number; y: number }): number => Math.hypot(p.x, p.y)

describe('radialLayout', () => {
  it('空入力は空配列', () => {
    expect(radialLayout({ nodes: [], edges: [] })).toEqual([])
  })

  it('根のみは中心(0,0)に配置する', () => {
    const out = radialLayout({ nodes: [node('n1', 0)], edges: [] })
    expect(out).toHaveLength(1)
    const root = out[0]!
    expect(root.position.x).toBeCloseTo(0)
    expect(root.position.y).toBeCloseTo(0)
  })

  it('全ノードに座標を返す', () => {
    const nodes = [node('n1', 0), node('n2', 1), node('n3', 1), node('n4', 1)]
    const edges = [edge('n1', 'n2'), edge('n1', 'n3'), edge('n1', 'n4')]
    const out = radialLayout({ nodes, edges })
    expect(out.map((p) => p.id).sort()).toEqual(['n1', 'n2', 'n3', 'n4'])
  })

  it('depth1 の子は中心から一定半径・互いに異なる角度に並ぶ', () => {
    const nodes = [node('n1', 0), node('n2', 1), node('n3', 1)]
    const edges = [edge('n1', 'n2'), edge('n1', 'n3')]
    const pos = new Map(radialLayout({ nodes, edges }).map((p) => [p.id, p.position]))
    const d2 = dist(pos.get('n2')!)
    const d3 = dist(pos.get('n3')!)
    expect(d2).toBeCloseTo(d3) // 同じリング上
    expect(d2).toBeGreaterThan(100)
    // 異なる位置（角度が違う）。
    expect(pos.get('n2')).not.toEqual(pos.get('n3'))
  })

  it('孫は親より中心から遠い（放射関係）', () => {
    const nodes = [node('n1', 0), node('n2', 1), node('n3', 2)]
    const edges = [edge('n1', 'n2'), edge('n2', 'n3')]
    const pos = new Map(radialLayout({ nodes, edges }).map((p) => [p.id, p.position]))
    expect(dist(pos.get('n3')!)).toBeGreaterThan(dist(pos.get('n2')!))
    expect(dist(pos.get('n2')!)).toBeGreaterThan(dist(pos.get('n1')!))
  })

  it('決定的（同一入力は同一出力）', () => {
    const nodes = [node('n1', 0), node('n2', 1), node('n3', 1)]
    const edges = [edge('n1', 'n2'), edge('n1', 'n3')]
    expect(radialLayout({ nodes, edges })).toEqual(radialLayout({ nodes, edges }))
  })

  it('端点が存在しないエッジは無視する', () => {
    const nodes = [node('n1', 0), node('n2', 1)]
    const edges = [edge('n1', 'n2'), edge('n1', 'ghost')]
    const out = radialLayout({ nodes, edges })
    expect(out).toHaveLength(2)
  })

  it('数十ノードでも全ノードに座標が返る（破綻なし）', () => {
    const nodes: MindMapNode[] = [node('n1', 0)]
    const edges: MindMapEdge[] = []
    for (let i = 0; i < 8; i++) {
      const p = `p${i}`
      nodes.push({ id: p, text: p, depth: 1, origin: 'auto' })
      edges.push(edge('n1', p))
      for (let j = 0; j < 4; j++) {
        const c = `${p}c${j}`
        nodes.push({ id: c, text: c, depth: 2, origin: 'auto' })
        edges.push(edge(p, c))
      }
    }
    const out = radialLayout({ nodes, edges })
    expect(out).toHaveLength(nodes.length)
    expect(new Set(out.map((p) => p.id)).size).toBe(nodes.length)
  })
})
