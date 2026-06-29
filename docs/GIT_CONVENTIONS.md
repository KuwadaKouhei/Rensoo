# Git 運用方針 (GIT_CONVENTIONS)

- 対象: Rensoo
- 最終更新: 2026-06-26

## バージョン管理: あり

Git で管理する。実装フェーズは **1タスク=1機能=1ブランチ=1PR** の縦スライスで進める（`docs/TASKS.md` と整合）。

## コミットメッセージ規約: Conventional Commits

形式: `<type>(<scope>): <subject>`（日本語の subject 可）

### type 一覧
| type | 用途 |
|---|---|
| `feat` | 機能追加 |
| `fix` | バグ修正 |
| `docs` | ドキュメントのみ |
| `style` | 整形（挙動に影響しない） |
| `refactor` | リファクタ（挙動を変えない） |
| `test` | テスト追加・修正 |
| `chore` | ビルド・依存・設定など |
| `perf` | パフォーマンス改善 |

### scope の例
`association`（連想生成）/ `mindmap`（描画・展開）/ `auth`（認証）/ `persistence`（保存）/ `ui` / `api` など。

### 例
- `feat(association): キーワードからの初回連想語生成を追加`
- `fix(mindmap): 自動展開がノード上限で停止しない不具合を修正`
- `test(association): 停止条件の境界値テストを追加`

## コミット粒度

- **意味のある最小単位**でコミットする。1コミットで1つの論理変更。
- 「動く状態」を保つ。ビルド/型チェック/重点テストが通る単位でコミットする。
- WIP の巨大コミットや、無関係変更の混在を避ける。

## ブランチ運用

- `main`: 常にグリーン（ビルド・重点テストが通る）に保つ。
- 作業ブランチ: `feature/<タスクID>-<slug>`（例: `feature/T03-association-generate`）。
- 1ブランチ＝1機能。完了したら PR を作りレビュー後に `main` へマージ（TASKS の順序に従う）。

## シークレット・機密の取り扱い（厳守）

- **`.env` および API キー等のシークレットは絶対にコミットしない**。
- `.gitignore` に `.env*`・認証情報・ローカル設定を必ず登録する。
- API キーはコードに直接書かない（サーバー側の環境変数で管理。CODING_PHILOSOPHY と整合）。
- 誤ってコミットした場合は履歴から除去し、キーをローテーションする。

## 関連
- タスク分解: [TASKS.md](./TASKS.md)（作成予定）
- 実装方針: [philosophy/CODING_PHILOSOPHY.md](./philosophy/CODING_PHILOSOPHY.md)
