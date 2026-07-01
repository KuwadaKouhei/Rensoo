// layout() の第2実装: 放射状（radial）レイアウト（DESIGN §3.3 / MindWeave デザイン準拠）。
// 起点（root）を中心に、子を同心円状へ再帰的に配置する純粋関数。React Flow とは独立でテスト可能。
// 座標は「中心原点（0,0）」で返す。MindMapCanvas は nodeOrigin=[0.5,0.5] で各ノード中心をこの座標に合わせる。

import type { LayoutFn, PositionedNode } from './layout'

/** depth1 の半径と、それ以降のリング間隔。 */
const RING_BASE = 320
const RING_STEP = 190
/** 12 時方向を起点にする（デザインと同じ見た目）。 */
const START_ANGLE = -Math.PI / 2
/** 親セクターに対して子が使う角度の割合（隣接ブランチの衝突を避けるため 1 未満）。 */
const CHILD_SPREAD = 0.82

/** depth に対応する中心からの半径。 */
const radiusFor = (depth: number): number => (depth <= 0 ? 0 : RING_BASE + (depth - 1) * RING_STEP)

export const radialLayout: LayoutFn = ({ nodes, edges }): readonly PositionedNode[] => {
  if (nodes.length === 0) return []

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const children = new Map<string, string[]>()
  const hasParent = new Set<string>()
  for (const e of edges) {
    // 端点が存在しないエッジは無視する（孤立エッジ保護）。
    if (!byId.has(e.source) || !byId.has(e.target)) continue
    const list = children.get(e.source) ?? []
    list.push(e.target)
    children.set(e.source, list)
    hasParent.add(e.target)
  }

  // 根: depth0 を優先。無ければ親を持たない最初のノード、それも無ければ先頭。
  const root =
    nodes.find((n) => n.depth === 0) ?? nodes.find((n) => !hasParent.has(n.id)) ?? nodes[0]
  if (!root) return [] // nodes 非空なので通常到達しないが、strict null 対策で明示。

  const positions = new Map<string, { x: number; y: number }>()
  const visited = new Set<string>()

  // ノードをセクター [a0, a1) の中央角に配置し、子を再帰配置する。
  const place = (id: string, depth: number, a0: number, a1: number): void => {
    if (visited.has(id)) return // サイクル/重複エッジ保護。
    visited.add(id)

    const mid = (a0 + a1) / 2
    const angle = depth === 0 ? START_ANGLE : mid
    const r = radiusFor(depth)
    positions.set(id, { x: r * Math.cos(angle), y: r * Math.sin(angle) })

    const kids = (children.get(id) ?? []).filter((k) => !visited.has(k))
    if (kids.length === 0) return

    // 子が使う角度範囲。根は全周、以降は親セクターを少し狭めて中央寄せする。
    let start: number
    let end: number
    if (depth === 0) {
      start = START_ANGLE
      end = START_ANGLE + Math.PI * 2
    } else {
      const span = (a1 - a0) * CHILD_SPREAD
      start = mid - span / 2
      end = mid + span / 2
    }
    const step = (end - start) / kids.length
    kids.forEach((k, i) => place(k, depth + 1, start + i * step, start + (i + 1) * step))
  }

  place(root.id, 0, START_ANGLE, START_ANGLE + Math.PI * 2)

  // 根から到達できない孤立ノードも描画から漏らさない（通常は起点が根なので発生しない）。
  let orphanIndex = 0
  for (const n of nodes) {
    if (!positions.has(n.id)) {
      const a = START_ANGLE + orphanIndex * 0.6
      positions.set(n.id, { x: RING_BASE * Math.cos(a), y: RING_BASE * Math.sin(a) })
      orphanIndex += 1
    }
  }

  return nodes.map((n) => ({ id: n.id, position: positions.get(n.id)! }))
}
