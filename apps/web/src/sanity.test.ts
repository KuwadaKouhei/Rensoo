import { describe, expect, it } from 'vitest'

// T01 の sanity テスト（Vitest が起動し green になることの確認）。
describe('web sanity', () => {
  it('1 + 1 = 2', () => {
    expect(1 + 1).toBe(2)
  })
})
