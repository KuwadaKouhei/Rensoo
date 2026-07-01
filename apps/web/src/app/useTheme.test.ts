// useTheme の純粋部分（初期値解決・DOM 反映）のユニットテスト。
// 実行環境は node（jsdom 非依存）。DOM 反映は classList.toggle 契約を満たす軽量フェイクで検証する。
import { describe, expect, it } from 'vitest'
import { applyThemeClass, resolveInitialTheme } from './useTheme'

describe('resolveInitialTheme', () => {
  it('保存値が light なら light を返す', () => {
    expect(resolveInitialTheme('light')).toBe('light')
  })

  it('保存値が dark なら dark を返す', () => {
    expect(resolveInitialTheme('dark')).toBe('dark')
  })

  it('未保存（null）はダーク既定', () => {
    expect(resolveInitialTheme(null)).toBe('dark')
  })

  it('不正値もダーク既定にフォールバックする', () => {
    expect(resolveInitialTheme('blue')).toBe('dark')
  })
})

/** classList.toggle(cls, force) の契約を満たす最小フェイク要素。 */
const fakeElement = () => {
  const classes = new Set<string>()
  return {
    classList: {
      toggle: (cls: string, force: boolean) => {
        if (force) classes.add(cls)
        else classes.delete(cls)
      },
      contains: (cls: string) => classes.has(cls),
    },
  } as unknown as HTMLElement & { classList: { contains: (c: string) => boolean } }
}

describe('applyThemeClass', () => {
  it('dark で .dark を付与する', () => {
    const el = fakeElement()
    applyThemeClass('dark', el)
    expect(el.classList.contains('dark')).toBe(true)
  })

  it('light で .dark を外す', () => {
    const el = fakeElement()
    applyThemeClass('dark', el)
    applyThemeClass('light', el)
    expect(el.classList.contains('dark')).toBe(false)
  })
})
