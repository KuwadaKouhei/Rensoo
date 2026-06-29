import { describe, expect, it } from 'vitest'
import { normalizeAssociations } from './normalizeAssociations'
import type { AssociationWord } from './associationProvider'

const words = (...xs: string[]): AssociationWord[] => xs.map((word) => ({ word }))

// FR-4 / FR-5 / AC-2 関連: 連想語の整形（重点ユニットテスト・TEST_PHILOSOPHY）。
describe('normalizeAssociations', () => {
  it('空白をトリムし、空文字のノードを除去する', () => {
    const result = normalizeAssociations(words('  宇宙 ', '', '   ', '星'), {
      input: '夜空',
      count: 6,
    })
    expect(result.map((w) => w.word)).toEqual(['宇宙', '星'])
  })

  it('入力語自身（トリム比較）を連想結果から除去する', () => {
    const result = normalizeAssociations(words('宇宙', ' 夜空 ', '星'), {
      input: '夜空',
      count: 6,
    })
    expect(result.map((w) => w.word)).toEqual(['宇宙', '星'])
  })

  it('重複（トリム後の同一表記）を先勝ちで除去する', () => {
    const result = normalizeAssociations(words('星', ' 星 ', '惑星', '星'), {
      input: '夜空',
      count: 6,
    })
    expect(result.map((w) => w.word)).toEqual(['星', '惑星'])
  })

  it('count を超えた分はトリムする', () => {
    const result = normalizeAssociations(words('a', 'b', 'c', 'd', 'e'), {
      input: 'x',
      count: 3,
    })
    expect(result.map((w) => w.word)).toEqual(['a', 'b', 'c'])
  })

  it('count に満たない場合はそのまま返す（不足は許容）', () => {
    const result = normalizeAssociations(words('a', 'b'), { input: 'x', count: 6 })
    expect(result.map((w) => w.word)).toEqual(['a', 'b'])
  })

  it('整形後の語は新しいオブジェクトとして返す（元配列を変更しない）', () => {
    const raw = words('  宇宙  ')
    const result = normalizeAssociations(raw, { input: '夜空', count: 6 })
    expect(result[0]?.word).toBe('宇宙')
    expect(raw[0]?.word).toBe('  宇宙  ')
  })
})
