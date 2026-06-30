// 自走展開の停止判定（純粋関数・DESIGN §6.3 / AC-3）。
// BFS の各ステップで「キュー投入前」に呼び、true なら以降の展開を止める。
// コスト保護の最終防衛線（NFR-3）。フレームワーク非依存・副作用なしで最重点テストの対象。

/** 停止判定の理由（停止条件由来のみ。user_stop/completed はオーケストレータ側で扱う）。 */
export type StopReason = 'max_nodes' | 'max_depth'

export interface ExpansionState {
  /** 現在までに確定した総ノード数（起点を含む）。 */
  readonly currentTotalNodes: number
  /** これから生成しようとする子ノードの depth（親 depth + 1）。 */
  readonly nextDepth: number
}

export interface ExpansionLimits {
  readonly maxNodes: number
  readonly maxDepth: number
}

export interface StopDecision {
  readonly stop: boolean
  readonly reason?: StopReason
}

/**
 * 展開を止めるべきかを判定する。
 * - nextDepth が maxDepth を超える → max_depth で停止。
 * - 総ノード数が maxNodes 以上に達している → max_nodes で停止。
 * depth 判定を先に行う（深さ超過の枝はノード数に関わらず展開しない）。
 */
export const shouldStopExpansion = (
  state: ExpansionState,
  limits: ExpansionLimits,
): StopDecision => {
  if (state.nextDepth > limits.maxDepth) {
    return { stop: true, reason: 'max_depth' }
  }
  if (state.currentTotalNodes >= limits.maxNodes) {
    return { stop: true, reason: 'max_nodes' }
  }
  return { stop: false }
}
