// テーマ（ダーク/ライト）切替（M6・DESIGN §2.1.1）。
// 既定はダーク（デザイン 1a）。選択は localStorage に永続化し、<html> の .dark クラスで表現する。
// 純粋部分（初期値の解決・DOM への反映）を関数に切り出し、React 非依存でテストできるようにする。

import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

/** localStorage のキー。 */
export const THEME_STORAGE_KEY = 'rensoo.theme'

/** 保存値から初期テーマを解決する（未保存/不正値はダーク既定）。純粋関数。 */
export const resolveInitialTheme = (stored: string | null): Theme =>
  stored === 'light' ? 'light' : 'dark'

/** テーマを <html> クラスへ反映する（副作用のみ・テスト時は要素を注入）。 */
export const applyThemeClass = (theme: Theme, root: HTMLElement): void => {
  root.classList.toggle('dark', theme === 'dark')
}

/** 現在テーマと切替関数を返すフック。 */
export interface UseThemeResult {
  readonly theme: Theme
  readonly toggleTheme: () => void
  readonly setTheme: (theme: Theme) => void
}

export const useTheme = (): UseThemeResult => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark'
    return resolveInitialTheme(window.localStorage.getItem(THEME_STORAGE_KEY))
  })

  // テーマ変更のたびに DOM クラスと保存値を同期する。
  useEffect(() => {
    applyThemeClass(theme, document.documentElement)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((next: Theme) => setThemeState(next), [])
  const toggleTheme = useCallback(
    () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    [],
  )

  return { theme, toggleTheme, setTheme }
}
