import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // `@/` エイリアスを vite.config と一致させる（テストからも解決できるように）。
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    // E2E（Playwright）はユニット/統合とは別ランナー。Vitest の対象から除外する。
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
})
