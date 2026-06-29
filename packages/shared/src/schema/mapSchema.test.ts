import { describe, expect, it } from 'vitest'
import { saveMapRequestSchema } from './mapSchema'

// AC-7 関連: 孤立エッジ禁止をスキーマで担保していることの確認（TEST_PHILOSOPHY: 編集/整合は重点）。
describe('saveMapRequestSchema（孤立エッジ検証）', () => {
  const baseNodes = [
    { id: 'n_root', text: '宇宙', depth: 0, origin: 'root' as const },
    { id: 'n_1', text: '星', depth: 1, origin: 'auto' as const },
  ]

  it('全エッジが存在するノードを参照していれば通る', () => {
    const result = saveMapRequestSchema.safeParse({
      title: '宇宙の連想',
      nodes: baseNodes,
      edges: [{ id: 'e_1', source: 'n_root', target: 'n_1' }],
      settings: { countPerNode: 6, maxDepth: 3, maxNodes: 50 },
    })
    expect(result.success).toBe(true)
  })

  it('存在しないノードを参照するエッジがあると検証エラーになる', () => {
    const result = saveMapRequestSchema.safeParse({
      title: '宇宙の連想',
      nodes: baseNodes,
      edges: [{ id: 'e_x', source: 'n_root', target: 'n_missing' }],
      settings: { countPerNode: 6, maxDepth: 3, maxNodes: 50 },
    })
    expect(result.success).toBe(false)
  })

  it('settings 省略時は既定値（6 / 3 / 50）が適用される', () => {
    const result = saveMapRequestSchema.safeParse({
      title: '空マップ',
      nodes: [{ id: 'n_root', text: '宇宙', depth: 0, origin: 'root' }],
      edges: [],
      settings: {},
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.settings).toEqual({ countPerNode: 6, maxDepth: 3, maxNodes: 50 })
    }
  })
})
