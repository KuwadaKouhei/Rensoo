import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('複数のクラスを結合する', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('falsy（false/null/undefined）を無視する', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('条件付きオブジェクトを true のキーだけ展開する', () => {
    expect(cn('a', { b: true, c: false })).toBe('a b')
  })

  it('Tailwind の衝突は後勝ちで解決する', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-sm', 'text-lg')).toBe('text-lg')
  })

  it('衝突しないユーティリティは両方残す', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
  })
})
