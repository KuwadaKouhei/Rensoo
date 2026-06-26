import { describe, expect, it } from 'vitest'
import { SHARED_PACKAGE_NAME } from './index'

// T01 の sanity テスト（Vitest が起動し green になることの確認）。
describe('shared sanity', () => {
  it('パッケージ名を公開している', () => {
    expect(SHARED_PACKAGE_NAME).toBe('@rensoo/shared')
  })
})
