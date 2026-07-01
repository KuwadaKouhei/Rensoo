// buildNodeTree の重点ユニット（階層・順序・境界）。
import { describe, expect, it } from 'vitest'
import type { MindMapEdge, MindMapNode } from '@rensoo/shared'
import { buildNodeTree } from './buildNodeTree'

const node = (id: string, depth: number, text = id): MindMapNode => ({
  id,
  text,
  depth,
  origin: depth === 0 ? 'root' : 'auto',
})
const edge = (source: string, target: string): MindMapEdge => ({ id: `${source}->${target}`, source, target })

describe('buildNodeTree', () => {
  it('空は空配列', () => {
    expect(buildNodeTree([], [])).toEqual([])
  })

  it('単一ノードは1行', () => {
    expect(buildNodeTree([node('n1', 0)], [])).toEqual([{ id: 'n1', label: 'n1', depth: 0 }])
  })

  it('前順で親→子→孫の順に並べ、depth を付与する', () => {
    const nodes = [node('n1', 0), node('n2', 1), node('n3', 2), node('n4', 1)]
    const edges = [edge('n1', 'n2'), edge('n2', 'n3'), edge('n1', 'n4')]
    const rows = buildNodeTree(nodes, edges)
    expect(rows.map((r) => r.id)).toEqual(['n1', 'n2', 'n3', 'n4'])
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2, 1])
  })

  it('子はエッジ追加順を保持する', () => {
    const nodes = [node('n1', 0), node('a', 1), node('b', 1)]
    const edges = [edge('n1', 'b'), edge('n1', 'a')]
    expect(buildNodeTree(nodes, edges).map((r) => r.id)).toEqual(['n1', 'b', 'a'])
  })

  it('根から到達できないノードも末尾に取りこぼさず含める', () => {
    const nodes = [node('n1', 0), node('n2', 1), node('orphan', 1)]
    const edges = [edge('n1', 'n2')] // orphan には親エッジがない
    const rows = buildNodeTree(nodes, edges)
    expect(rows.map((r) => r.id)).toEqual(['n1', 'n2', 'orphan'])
  })

  it('サイクルがあっても無限ループしない', () => {
    const nodes = [node('n1', 0), node('n2', 1)]
    const edges = [edge('n1', 'n2'), edge('n2', 'n1')]
    const rows = buildNodeTree(nodes, edges)
    expect(rows.map((r) => r.id)).toEqual(['n1', 'n2'])
  })

  it('数十ノードでも全ノードを含む', () => {
    const nodes: MindMapNode[] = [node('n1', 0)]
    const edges: MindMapEdge[] = []
    for (let i = 0; i < 30; i++) {
      const id = `c${i}`
      nodes.push(node(id, 1))
      edges.push(edge('n1', id))
    }
    expect(buildNodeTree(nodes, edges)).toHaveLength(nodes.length)
  })
})
