// テーマ切替ボタン（M6）。ダーク⇄ライトをトグルする。
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useThemeContext } from '@/app/ThemeProvider'

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useThemeContext()
  const isDark = theme === 'dark'
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      aria-label={isDark ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'}
      title={isDark ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  )
}
