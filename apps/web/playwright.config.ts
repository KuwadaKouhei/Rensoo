import { defineConfig, devices } from '@playwright/test'

// ハッピーパス E2E（DESIGN §8 / TEST_PHILOSOPHY: E2E は少数）。
// API は Playwright のルートモックでスタブするため、実 LLM/Supabase 不要で決定的に動く。
// webServer はビルド済みアプリを vite preview で配信する。
const PORT = 4173

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
