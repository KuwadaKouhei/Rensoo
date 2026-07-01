// 生成中 UI 表示条件のユニットテスト（status × nodeCount の分岐）。
import { describe, expect, it } from 'vitest'
import {
  isInteractionLocked,
  shouldShowBuildingIndicator,
  shouldShowLoadingOverlay,
} from './generatingUi'

describe('isInteractionLocked', () => {
  it('生成中はロックする', () => {
    expect(isInteractionLocked('generating')).toBe(true)
  })
  it('idle/error はロックしない', () => {
    expect(isInteractionLocked('idle')).toBe(false)
    expect(isInteractionLocked('error')).toBe(false)
  })
})

describe('shouldShowLoadingOverlay', () => {
  it('生成中かつノードが1個以下は全画面ローディング', () => {
    expect(shouldShowLoadingOverlay('generating', 0)).toBe(true)
    expect(shouldShowLoadingOverlay('generating', 1)).toBe(true)
  })
  it('ノードが増えたら全画面ローディングを出さない', () => {
    expect(shouldShowLoadingOverlay('generating', 2)).toBe(false)
  })
  it('生成中でなければ出さない', () => {
    expect(shouldShowLoadingOverlay('idle', 0)).toBe(false)
  })
})

describe('shouldShowBuildingIndicator', () => {
  it('生成中かつノードが2個以上で追加中インジケータ', () => {
    expect(shouldShowBuildingIndicator('generating', 2)).toBe(true)
  })
  it('ノードが1個以下では出さない（ローディング側で扱う）', () => {
    expect(shouldShowBuildingIndicator('generating', 1)).toBe(false)
  })
  it('生成中でなければ出さない', () => {
    expect(shouldShowBuildingIndicator('idle', 5)).toBe(false)
  })
})
