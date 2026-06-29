# CLAUDE.md — Rensoo 実装ガイド

このファイルは Claude Code（および開発者）が Rensoo を実装・修正する際の入口となる索引兼ルール集です。
設計フェーズの成果物（`docs/` 配下）を「読まれる索引」として集約し、実装の進め方をルール化しています。
**実装に入る前に必ずこのファイルと、ここから誘導される設計ドキュメントに目を通してください。**

---

## 1. プロジェクト概要

**Rensoo** は、ユーザーが入力したキーワードを起点に、LLM（Anthropic Claude）が生成した連想語を
**マインドマップ状に可視化**し、そこから**自走的に思考を広げる**体験を提供する Web アプリです。
ブレインストーミング・企画・命名・学習などの初動を、連想の連鎖で素早く加速することを狙います。

コアバリューは「キーワードを入れて『作成』を押すだけで、連想がマインドマップとして自動で広がっていく」こと。
自走展開は停止条件（最大深さ・総ノード上限）でコスト暴走を防ぎ、自動／手動の切り替えにも対応します。
ログイン不要のゲスト利用が可能で、認証ユーザーは作成したマップを保存・一覧・再編集・削除できます。

---

## 2. 技術スタック要約

- **フロント**: React + Vite ／ Zustand（ドメイン状態）／ React Flow + Dagre（マインドマップ描画・自動レイアウト）
- **API**: Hono on Node.js（TypeScript）— LLM オーケストレーション（自走展開 BFS・停止条件・レート制御）を担う
- **データ／認証**: Supabase（PostgreSQL ＋ Auth ＋ RLS による本人限定アクセス）
- **LLM**: Anthropic Claude（`AssociationProvider` 抽象の背後に隠蔽し、差し替え可能にする）
- **検証**: Zod（フロント／サーバー／LLM 応答を同一スキーマで検証）
- **テスト**: Vitest ／ **品質**: ESLint（Flat Config）+ Prettier ／ **TypeScript strict**
- **構成**: pnpm workspaces による軽量モノレポ（`apps/web` ／ `apps/api` ／ `packages/shared`）

> 選定理由・比較・バージョン等の詳細は [`docs/TECH_STACK.md`](docs/TECH_STACK.md) を参照してください。

---

## 3. 設計ドキュメント索引（`docs/`）

実装はこれらのドキュメントを正とします。コードと食い違う場合はドキュメントを確認し、判断を仰いでください。

| ドキュメント | 役割（何を定めているか） | 参照タイミング |
|---|---|---|
| [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) | 背景・目的・ユーザーストーリー・FR/NFR・受け入れ条件（AC-1〜13） | 「何を作るか」を確認するとき |
| [`docs/FEASIBILITY.md`](docs/FEASIBILITY.md) | 各要件の実現可能性判定と一次情報の根拠、PoC 推奨ポイント | 技術的リスク・前提を確認するとき |
| [`docs/philosophy/PLAN_PHILOSOPHY.md`](docs/philosophy/PLAN_PHILOSOPHY.md) | 設計思想（拡張性重視・変動点の抽象化・依存方向は内向き・過剰設計の回避） | 設計判断・抽象化の是非を考えるとき |
| [`docs/philosophy/CODING_PHILOSOPHY.md`](docs/philosophy/CODING_PHILOSOPHY.md) | 実装思想（型厳格・エラー明示・スキーマ検証・シークレットはサーバー側） | コードを書く前・レビュー時 |
| [`docs/philosophy/TEST_PHILOSOPHY.md`](docs/philosophy/TEST_PHILOSOPHY.md) | テスト思想（重要部分を絞る・連想/停止条件/編集/認可を重点） | テストを書くとき |
| [`docs/GIT_CONVENTIONS.md`](docs/GIT_CONVENTIONS.md) | Git 運用（1機能=1ブランチ=1PR、Conventional Commits、scope 一覧） | ブランチ・コミット・PR を作るとき |
| [`docs/TECH_STACK.md`](docs/TECH_STACK.md) | 技術選定（採用技術・比較・アーキテクチャ全体像） | スタック・ライブラリ選定を確認するとき |
| [`docs/DESIGN.md`](docs/DESIGN.md) | アーキテクチャ（レイヤ・コンポーネント・拡張点 IF・API・自走展開の制御フロー） | 構造・IF・データフローを実装するとき |
| [`docs/DATABASE.md`](docs/DATABASE.md) | DB 設計（テーブル定義・型・制約・RLS ポリシー SQL・マイグレーション・ER 図） | DB・永続化・RLS を実装するとき |
| [`docs/DIRECTORY_STRUCTURE.md`](docs/DIRECTORY_STRUCTURE.md) | フォルダ／ファイル階層・配置ルール（新規ファイルをどこに置くか） | ファイルを新規追加するとき |
| [`docs/TASKS.md`](docs/TASKS.md) | 実装タスク分解（T01〜T16・マイルストーン・推奨ブランチ名・トレーサビリティ） | 次に何を実装するか決めるとき（駆動表） |

---

## 4. 実装の進め方

- 実装は [`docs/TASKS.md`](docs/TASKS.md) の **タスク一覧（T01〜T16）を駆動表**として、上から順に着手します。
  各タスクのマージ時点で `main` がグリーン（ビルド・型チェック・重点テスト通過）を保てる縦スライス順に並んでいます。
- **1機能 = 1ブランチ = 1PR** の縦スライスで進めます（ブランチ名は各タスクの「推奨ブランチ名」、例 `feature/T01-monorepo-init`）。
- テスト専用タスクは作らず、**各タスクの成果物にテストを含めます**（縦スライス内でテストも書く）。
- **最初の着手は T01（モノレポ初期化・CI 雛形）**。`apps/web`・`apps/api`・`packages/shared` の雛形、TS strict 共通設定、
  ESLint/Prettier、`.gitignore`（`.env*` 除外）、CI（`tsc --noEmit` / ESLint / Vitest）を整えます。

---

## 5. 重要な運用ルール（最重要・必ず守る）

1. **実装は必ずドキュメントに沿う**。`DESIGN.md` / `DATABASE.md` / `DIRECTORY_STRUCTURE.md` / `philosophy/*` を正とし、
   コードがドキュメントと食い違ったら**手を止めて確認**する。憶測で先に進めない。
2. **何かを変更したら、コードとあわせて該当ドキュメントも必ず一緒に更新する**。コードとドキュメントを乖離させない。
   仕様を変えるときは**先にドキュメントを直してから実装する**（ドキュメント駆動）。
3. **設計から逸脱する場合は手を止め、理由をドキュメントに残す**。思想（拡張性重視・型厳格＋エラー明示・テストは重点を絞る）に従う。
4. **シークレット／API キー／`.env` はコミットしない・コードに直書きしない。`.env` ファイルは読まない**。
   LLM（Anthropic）の API キーは**サーバー側（`apps/api` の環境変数）のみ**で扱い、フロントに出さない。
5. **ユーザー向けメッセージ・エラーは日本語**にする。`try-catch` でエラーを握りつぶさない
   （握る場合は必ずログ＋ユーザー通知 or 再スロー）。外部入出力（LLM 応答・API・フォーム）は Zod でスキーマ検証してから扱う。
6. **TypeScript strict** を維持し、`any` は原則禁止（必要時は理由コメント）。
7. **変更後は「どこを変更したか」を日本語で説明する**。

---

## 6. 拡張点と配置の原則

Rensoo の拡張点は **3つだけ**に限定されています（PLAN_PHILOSOPHY「変動点の抽象化」）。新規実装はこの抽象の背後に置きます。

- **連想ソース**: `AssociationProvider`（IF は `packages/shared` のドメイン側、実装は `apps/api` の `infra` 側）。
  Claude は `ClaudeAssociationProvider` として隠蔽。**新プロバイダ追加 = infra に実装クラスを足し、DI 配線を1箇所書き換える**だけで済むようにする。
- **永続化**: `MindMapRepository`（IF は `packages/shared`、実装は `SupabaseMindMapRepository`）。保存先の変更がドメインに波及しないようにする。
- **レイアウト**: `layout()`（描画レイアウトの抽象。実装は Dagre）。

依存方向は内向き（ドメインは FW/SDK/DB に依存しない）。新規ファイルの置き場は
[`docs/DIRECTORY_STRUCTURE.md`](docs/DIRECTORY_STRUCTURE.md) の配置ルールに従い、テストは対象と同階層に `*.test.ts(x)` を co-location します。

---

## 7. 主要コマンド（pnpm 前提・詳細は実装で確定）

> 本プロジェクトは実装着手前のため、以下は想定コマンドです。具体的な script は T01（モノレポ初期化）で確定します。
> 確定後はこの節を実際の `package.json` の scripts に合わせて更新してください。

| 目的 | コマンド（想定） |
|---|---|
| 依存インストール | `pnpm install` |
| 型チェック（全体） | `pnpm -r tsc --noEmit` |
| Lint | `pnpm -r lint` |
| テスト | `pnpm -r test`（Vitest） |
| ビルド（全体） | `pnpm -r build` |
| フロント開発サーバー | `pnpm --filter web dev` |
| API 開発サーバー | `pnpm --filter api dev` |

CI（`.github/workflows/ci.yml`）は **型チェック・ESLint・Vitest** をゲートとして PR をブロックします。
