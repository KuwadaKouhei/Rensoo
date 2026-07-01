// テーマの単一ソース（M6・DESIGN §2.1.1）。アプリ全体で 1 つのテーマ状態を共有する。
// useTheme を Provider で 1 度だけ呼び、切替はコンテキスト経由で行う（複数箇所で状態が分岐しないように）。

import { createContext, useContext, type ReactNode } from 'react'
import { useTheme, type UseThemeResult } from './useTheme'

const ThemeContext = createContext<UseThemeResult | null>(null)

/** アプリ直下に置き、テーマ状態を配下へ供給する。 */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const value = useTheme()
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/** テーマ状態と切替関数を取得する（ThemeProvider の内側でのみ使用可）。 */
export const useThemeContext = (): UseThemeResult => {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useThemeContext は ThemeProvider の内側で使ってください')
  }
  return ctx
}
