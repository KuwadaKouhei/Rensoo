// fitView トリガ判定のユニットテスト（status 遷移の分岐）。
import { describe, expect, it } from 'vitest'
import { shouldFitViewOnStatusChange } from './fitViewOnComplete'

describe('shouldFitViewOnStatusChange', () => {
  it('generating → idle で fit する（完了）', () => {
    expect(shouldFitViewOnStatusChange('generating', 'idle')).toBe(true)
  })

  it('generating 継続では fit しない（段階描画中）', () => {
    expect(shouldFitViewOnStatusChange('generating', 'generating')).toBe(false)
  })

  it('generating → error では fit しない（失敗）', () => {
    expect(shouldFitViewOnStatusChange('generating', 'error')).toBe(false)
  })

  it('idle → idle では fit しない（無変化）', () => {
    expect(shouldFitViewOnStatusChange('idle', 'idle')).toBe(false)
  })

  it('idle → generating では fit しない（開始）', () => {
    expect(shouldFitViewOnStatusChange('idle', 'generating')).toBe(false)
  })
})
