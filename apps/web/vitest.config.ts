import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // E2E（Playwright）はユニット/統合とは別ランナー。Vitest の対象から除外する。
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
})
