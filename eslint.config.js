// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

/**
 * Rensoo ルート ESLint 設定（Flat Config）。
 *
 * 基本ルール（JS / TypeScript recommended）に加え、依存方向（DIRECTORY_STRUCTURE §3.1）を
 * `no-restricted-imports` で強制する。
 *   - ドメイン中核（packages/shared/src/domain, apps/api/src/domain）は FW/SDK/UI を import しない。
 *   - 例: apps/api/src/app/** が infra/ の具体実装を直接 import しない等の規約は、該当層が実装される
 *     タスク（T08 ほか）で追加する。
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
    rules: {
      // `_` 接頭辞の引数/変数は意図的な未使用として許容（IF 準拠で使わない引数など）。
      // rest 構文で取り出した兄弟プロパティの除外も許容（{ a, ...rest } で a を捨てる）。
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  // 依存方向の強制（DIRECTORY_STRUCTURE §3.1）:
  // ドメイン中核（内側）は FW / SDK / UI を import しない。
  {
    files: ['packages/shared/src/domain/**/*.ts', 'apps/api/src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'domain は UI(React) に依存しません' },
            { name: 'hono', message: 'domain は FW(Hono) に依存しません' },
            { name: '@anthropic-ai/sdk', message: 'domain は LLM SDK に依存しません' },
            { name: '@supabase/supabase-js', message: 'domain は Supabase SDK に依存しません' },
          ],
          patterns: [
            { group: ['hono/*'], message: 'domain は FW(Hono) に依存しません' },
            {
              group: ['@anthropic-ai/*', '@supabase/*'],
              message: 'domain は外部 SDK に依存しません',
            },
          ],
        },
      ],
    },
  },
)
