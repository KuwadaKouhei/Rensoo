// ノードツリー導出（M6・T20）。ストアの nodes/edges（親→子エッジ）から、
// 起点（depth0）を根とする親子ツリーを DFS 前順で平坦化する純粋関数。UI 非依存でテスト可能。

import type { MindMapEdge, MindMapNode } from '@rensoo/shared'

/** ツリー表示用の1行（インデントは depth で決める）。 */
export interface NodeTreeRow {
  readonly id: string
  readonly label: string
  readonly depth: number
}

/**
 * nodes/edges から親子ツリー（前順の平坦リスト）を作る。
 * - 根: depth0 のノード（複数あれば元の順序で順に展開）。無ければ親を持たないノード。
 * - 子はエッジ（source→target）順を保持する。サイクル/重複訪問はスキップする。
 * - 根から到達できないノードは末尾へ（元の順序）追加し、取りこぼさない。
 */
export const buildNodeTree = (
  nodes: readonly MindMapNode[],
  edges: readonly MindMapEdge[],
): readonly NodeTreeRow[] => {
  if (nodes.length === 0) return []

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const children = new Map<string, string[]>()
  const hasParent = new Set<string>()
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue
    const list = children.get(e.source) ?? []
    list.push(e.target)
    children.set(e.source, list)
    hasParent.add(e.target)
  }

  const rows: NodeTreeRow[] = []
  const visited = new Set<string>()

  const walk = (id: string, depth: number): void => {
    if (visited.has(id)) return
    visited.add(id)
    const n = byId.get(id)
    if (!n) return
    rows.push({ id: n.id, label: n.text, depth })
    for (const child of children.get(id) ?? []) {
      walk(child, depth + 1)
    }
  }

  // 根の候補: depth0 → 親を持たない → 先頭。元の順序で処理する。
  const roots = nodes.filter((n) => n.depth === 0)
  const rootIds = roots.length > 0 ? roots.map((n) => n.id) : nodes.filter((n) => !hasParent.has(n.id)).map((n) => n.id)
  for (const id of rootIds) {
    // ツリー上の実 depth を使うため、根は depth 0 起点で辿る。
    walk(id, byId.get(id)?.depth ?? 0)
  }

  // 未訪問（根から到達不能）のノードを元順で末尾に足す。
  for (const n of nodes) {
    if (!visited.has(n.id)) {
      walk(n.id, n.depth)
    }
  }

  return rows
}
