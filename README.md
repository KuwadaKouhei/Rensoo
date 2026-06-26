# Rensoo

キーワードを入力すると、LLM（Claude）による連想語をマインドマップとして可視化し、
自動連鎖・手動操作で思考を自走的に広げる Web アプリです。

- 設計ドキュメント: [`docs/`](docs/)
- 実装ガイド・運用ルール: [`CLAUDE.md`](CLAUDE.md)

> 本 README は雛形です。技術スタックバッジ・構築手順・環境変数などの整備は STEP7（README 整備）で行います。

## モノレポ構成

| パッケージ        | 役割                                                  |
| ----------------- | ----------------------------------------------------- |
| `apps/web`        | フロントエンド（React + Vite）                        |
| `apps/api`        | API サーバー（Hono on Node.js）                       |
| `packages/shared` | フロント／サーバー共有の型・Zod スキーマ・ドメイン IF |

## 主要コマンド（ルートで実行）

```bash
pnpm install        # 依存インストール
pnpm typecheck      # 型チェック（全パッケージ）
pnpm lint           # ESLint
pnpm test           # Vitest（全パッケージ）
pnpm build          # ビルド（全パッケージ）
```
