import { describe, expect, it } from 'vitest'
import { shouldStopExpansion } from './shouldStopExpansion'

// 停止条件は最重点（TEST_PHILOSOPHY）。境界値（上限ちょうど・上限+1）を必ず検証する。
const limits = { maxNodes: 50, maxDepth: 3 }

describe('shouldStopExpansion', () => {
  it('継続: depth が上限以内・ノード数が上限未満なら止めない', () => {
    expect(shouldStopExpansion({ currentTotalNodes: 10, nextDepth: 2 }, limits)).toEqual({
      stop: false,
    })
  })

  it('境界: nextDepth が maxDepth ちょうどは継続（その深さの子は許可）', () => {
    expect(shouldStopExpansion({ currentTotalNodes: 10, nextDepth: 3 }, limits)).toEqual({
      stop: false,
    })
  })

  it('境界: nextDepth が maxDepth+1 で max_depth 停止', () => {
    expect(shouldStopExpansion({ currentTotalNodes: 10, nextDepth: 4 }, limits)).toEqual({
      stop: true,
      reason: 'max_depth',
    })
  })

  it('境界: 総ノード数が maxNodes ちょうどで max_nodes 停止', () => {
    expect(shouldStopExpansion({ currentTotalNodes: 50, nextDepth: 2 }, limits)).toEqual({
      stop: true,
      reason: 'max_nodes',
    })
  })

  it('境界: 総ノード数が maxNodes 未満（49）は継続', () => {
    expect(shouldStopExpansion({ currentTotalNodes: 49, nextDepth: 2 }, limits)).toEqual({
      stop: false,
    })
  })

  it('優先順位: depth 超過とノード超過が同時なら depth を優先する', () => {
    expect(shouldStopExpansion({ currentTotalNodes: 50, nextDepth: 4 }, limits)).toEqual({
      stop: true,
      reason: 'max_depth',
    })
  })

  it('maxDepth=1 / maxNodes=2 のような最小設定でも境界が効く', () => {
    expect(
      shouldStopExpansion({ currentTotalNodes: 1, nextDepth: 1 }, { maxNodes: 2, maxDepth: 1 }),
    ).toEqual({ stop: false })
    expect(
      shouldStopExpansion({ currentTotalNodes: 2, nextDepth: 1 }, { maxNodes: 2, maxDepth: 1 }),
    ).toEqual({ stop: true, reason: 'max_nodes' })
    expect(
      shouldStopExpansion({ currentTotalNodes: 1, nextDepth: 2 }, { maxNodes: 2, maxDepth: 1 }),
    ).toEqual({ stop: true, reason: 'max_depth' })
  })
})
