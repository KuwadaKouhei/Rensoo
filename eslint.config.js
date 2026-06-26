// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

/**
 * Rensoo ルート ESLint 設定（Flat Config）。
 *
 * T01 では基本ルール（JS / TypeScript recommended）と無視設定までを骨子として定義する。
 * 依存方向（DIRECTORY_STRUCTURE §3.1）の `no-restricted-imports` による強制は T02 で本格設定する。
 *   - 例: packages/shared/src/domain/** は hono / @anthropic-ai/sdk / @supabase/supabase-js / react を import しない
 *   - 例: apps/api/src/app/** は infra/ の具体実装を直接 import しない（DI 注入）
 */
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.vite/**', '**/coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
)
