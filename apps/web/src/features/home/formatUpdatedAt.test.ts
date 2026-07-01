// formatUpdatedAt の相対表記ユニットテスト（now を固定して決定的に検証）。
import { describe, expect, it } from 'vitest'
import { formatUpdatedAt } from './formatUpdatedAt'

const NOW = Date.parse('2026-07-01T12:00:00Z')

describe('formatUpdatedAt', () => {
  it('1分未満は「たった今」', () => {
    expect(formatUpdatedAt('2026-07-01T11:59:30Z', NOW)).toBe('たった今')
  })

  it('分単位', () => {
    expect(formatUpdatedAt('2026-07-01T11:30:00Z', NOW)).toBe('30分前')
  })

  it('時間単位', () => {
    expect(formatUpdatedAt('2026-07-01T09:00:00Z', NOW)).toBe('3時間前')
  })

  it('日単位', () => {
    expect(formatUpdatedAt('2026-06-29T12:00:00Z', NOW)).toBe('2日前')
  })

  it('1週間以上前は日付表記（相対語を含まない）', () => {
    const label = formatUpdatedAt('2026-06-01T12:00:00Z', NOW)
    expect(label).not.toMatch(/前|たった今/)
    expect(label.length).toBeGreaterThan(0)
  })

  it('不正な日時文字列はそのまま返す', () => {
    expect(formatUpdatedAt('not-a-date', NOW)).toBe('not-a-date')
  })
})
