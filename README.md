# Rensoo

キーワードを入力して「作成」を押すだけで、LLM（Anthropic Claude）が生成した連想語をマインドマップとして可視化し、
そこから思考を自走的に広げる Web アプリです。連想は最大深さ・総ノード上限などの停止条件で安全に自動展開され、
自動／手動の切り替えやノードの手動編集にも対応します。ログイン不要のゲスト利用が可能で、認証ユーザーは作成したマップを
保存・一覧・再編集・削除できます。

ブレインストーミング・企画・命名・学習などの初動を、連想の連鎖で素早く加速することを狙ったプロジェクトです。

## 技術スタック

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![React Flow](<https://img.shields.io/badge/React%20Flow%20(%40xyflow)-12-FF0072>)
![Zustand](https://img.shields.io/badge/Zustand-5-433E38)
![Hono](https://img.shields.io/badge/Hono-4-E36002?logo=hono&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=nodedotjs&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth%20%2B%20RLS-3FCF8E?logo=supabase&logoColor=white)
![Anthropic Claude](https://img.shields.io/badge/Anthropic%20Claude-SDK-D97757?logo=anthropic&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3-3E67B1?logo=zod&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-3-6E9F18?logo=vitest&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-1.49-2EAD33?logo=playwright&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)

選定理由・比較・アーキテクチャの詳細は [`docs/TECH_STACK.md`](docs/TECH_STACK.md) を参照してください。

## 主な機能

- **連想の自走展開**: キーワードを起点に Claude が連想語を生成し、マインドマップとして自動で広がっていく。生成件数は設定に追従する（AC-1, AC-2）。
- **自動／手動展開トグル**: 自動連鎖と、ノードをクリックして展開する手動モード（連鎖しない）を切り替えられる（AC-4, AC-5）。
- **停止条件によるコスト制御**: 最大深さ・総ノード上限に達すると自動停止し、自動展開中の停止操作以降はノードが増えない（AC-3, AC-6）。
- **ノードの手動編集**: ノードの追加・編集・削除に対応（削除時に孤立エッジを残さない整合を保証, AC-7）。
- **ゲスト利用**: ログインなしで連想・可視化・マップ操作が一通り行える（AC-8）。
- **保存・一覧・再編集・削除**: 「保存」時にログインを要求し、認証ユーザーは Supabase（OAuth）で自分のマップを保存・一覧・開いて再編集・削除できる。他ユーザーのマップにはアクセスできない（RLS, AC-9〜AC-11）。
- **一貫したエラー処理と秘匿**: LLM 失敗時は日本語エラー＋再試行でアプリは落ちず（AC-12）、LLM API キーはブラウザに露出しない（AC-13）。

要件と受け入れ条件（AC-1〜13）の全文は [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) を参照してください。

## アーキテクチャ概要

pnpm workspaces による軽量モノレポ構成です。フロント／サーバーで型・Zod スキーマ・ドメイン IF を `packages/shared`
に集約し、フロント／サーバー間の型ズレを構造的に防ぎます。依存方向は内向き（ドメインは FW/SDK/DB に依存しない）です。

| パッケージ        | 役割                                                                   | 主な技術                                |
| ----------------- | ---------------------------------------------------------------------- | --------------------------------------- |
| `apps/web`        | フロントエンド（SPA）。マインドマップ描画・操作 UI・認証導線           | React, Vite, Zustand, React Flow, Dagre |
| `apps/api`        | API サーバー。LLM オーケストレーション（自走展開 BFS・停止条件・認可） | Hono on Node.js, Anthropic SDK, jose    |
| `packages/shared` | フロント／サーバー共有の型・Zod スキーマ・ドメイン IF                  | Zod                                     |

拡張点は次の 3 つに限定され、抽象（IF）は内側（`packages/shared`）に、実装は外側（`apps/api` の `infra` 等）に置きます。
新実装の追加は局所で完結し、ドメインや他レイヤに波及しません。

| 拡張点                | 抽象（IF の置き場）                              | 既定の実装                                          |
| --------------------- | ------------------------------------------------ | --------------------------------------------------- |
| `AssociationProvider` | `packages/shared`（連想ソースの抽象）            | `apps/api` の `ClaudeAssociationProvider`（Claude） |
| `MindMapRepository`   | `packages/shared`（永続化の抽象）                | `apps/api` の `SupabaseMindMapRepository`           |
| `layout()`            | `apps/web` の `mindmap-layout`（描画レイアウト） | Dagre による自動レイアウト                          |

レイヤ構成・コンポーネント・API・自走展開の制御フローの詳細は [`docs/DESIGN.md`](docs/DESIGN.md) を参照してください。

## ディレクトリ構成（主要のみ）

```text
Rensoo/
├── apps/
│   ├── web/                 # フロントエンド（React + Vite）
│   │   └── src/
│   │       ├── features/    # 機能の縦スライス（マップ編集・生成設定・認証/保存 UI）
│   │       ├── store/       # フロントドメイン中核（Zustand・UI 非依存）
│   │       ├── api-client/  # 型付き fetch + Zod 検証 + SSE + エラー日本語化
│   │       ├── mindmap-layout/  # 拡張点 layout()（Dagre 実装）
│   │       └── auth/        # Supabase Auth クライアント
│   └── api/                 # API サーバー（Hono on Node.js）
│       └── src/
│           ├── http/        # ルーティング・CORS・認証ミドルウェア・エラー写像
│           ├── app/         # オーケストレーション（BFS・停止判定呼び出し・レート制御）
│           ├── domain/      # API 固有のドメイン純粋ロジック（停止判定など）
│           └── infra/       # 拡張点の実装（providers / repositories）
├── packages/
│   └── shared/              # 共有の型・Zod スキーマ・ドメイン IF（依存される中心）
├── supabase/migrations/     # DB スキーマ・RLS マイグレーション
└── docs/                    # 設計ドキュメント群
```

配置ルール・各ディレクトリの責務は [`docs/DIRECTORY_STRUCTURE.md`](docs/DIRECTORY_STRUCTURE.md) を参照してください。

## セットアップ

### 前提

- Node.js >= 20
- pnpm（本リポジトリは `pnpm@10` を `packageManager` に固定）

### 手順

1. 依存をインストールします。

   ```bash
   pnpm install
   ```

2. 環境変数を設定します（[環境変数](#環境変数) を参照）。`apps/api` には少なくとも `ANTHROPIC_API_KEY` が必須です。
   雛形をコピーして値を埋めてください（`.env` は `.gitignore` 済みでコミットされません）。

   ```bash
   cp apps/api/.env.example apps/api/.env
   # apps/api/.env を編集して ANTHROPIC_API_KEY などを設定
   ```

   `apps/api` の `dev` / `start` は `--env-file-if-exists=.env` で `apps/api/.env` を自動読み込みします
   （ファイルが無くても起動は失敗せず、シェルの環境変数だけで動かすことも可能）。
   Supabase 関連を設定しない場合、保存・認証機能は無効化され、ゲスト機能のみ動作します。

3. API サーバーを起動します（既定ポート 8787）。

   ```bash
   pnpm --filter @rensoo/api dev
   ```

4. 別ターミナルでフロント開発サーバーを起動します（Vite 既定ポート 5173）。

   ```bash
   pnpm --filter @rensoo/web dev
   ```

> 共有パッケージ（`@rensoo/shared`）は型・スキーマの提供元です。型エラーが出る場合は先に
> `pnpm build:shared` を実行してください（[トラブルシューティング](#トラブルシューティング) を参照）。

## 環境変数

値は記載しません。各変数の名前・対象・要否・用途のみを示します。**シークレット（`ANTHROPIC_API_KEY`）は
サーバー（`apps/api`）でのみ扱い、フロントには出しません。** フロントに露出するのは `VITE_` 接頭辞の公開値だけです。

### `apps/api`（サーバー）

| 変数名              | 必須/任意 | 用途                                                                                    |
| ------------------- | --------- | --------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | 必須      | Anthropic Claude の API キー。**サーバー専用シークレット**。未設定だと API は起動失敗。 |
| `ASSOCIATION_MODEL` | 任意      | 連想生成に使う Claude モデル名（未指定なら実装の既定値）。                              |
| `SUPABASE_URL`      | 任意      | Supabase プロジェクト URL。設定時に JWT 検証（JWKS）を有効化。                          |
| `SUPABASE_ANON_KEY` | 任意      | Supabase anon キー（公開鍵）。`SUPABASE_URL` と揃うと保存系（RLS 引き継ぎ）を有効化。   |
| `WEB_ORIGIN`        | 任意      | CORS 許可オリジン。未指定なら全許可（本番では必ず指定）。                               |
| `PORT`              | 任意      | API のリッスンポート（既定 8787）。                                                     |

### `apps/web`（フロント・`VITE_` 接頭辞のみバンドルに露出）

| 変数名                   | 必須/任意 | 用途                                                                      |
| ------------------------ | --------- | ------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`      | 任意      | API サーバーのベース URL（未設定なら同一オリジン）。                      |
| `VITE_SUPABASE_URL`      | 任意      | Supabase プロジェクト URL（公開値）。未設定なら認証は無効（ゲストのみ）。 |
| `VITE_SUPABASE_ANON_KEY` | 任意      | Supabase anon キー（公開可能な公開鍵。シークレットではない）。            |

## 主要コマンド

ルートで実行するコマンド（`package.json` の scripts）です。

| 目的                         | コマンド            |
| ---------------------------- | ------------------- |
| 依存インストール             | `pnpm install`      |
| 共有パッケージのビルド       | `pnpm build:shared` |
| 型チェック（共有ビルド込み） | `pnpm typecheck`    |
| Lint（ESLint）               | `pnpm lint`         |
| フォーマット確認（Prettier） | `pnpm format`       |
| フォーマット適用（Prettier） | `pnpm format:write` |
| テスト（共有ビルド込み）     | `pnpm test`         |
| ビルド（全パッケージ）       | `pnpm build`        |

パッケージ個別の主なコマンドです。

| 目的                 | コマンド                            |
| -------------------- | ----------------------------------- |
| フロント開発サーバー | `pnpm --filter @rensoo/web dev`     |
| フロントビルド       | `pnpm --filter @rensoo/web build`   |
| フロントプレビュー   | `pnpm --filter @rensoo/web preview` |
| E2E（Playwright）    | `pnpm --filter @rensoo/web e2e`     |
| API 開発サーバー     | `pnpm --filter @rensoo/api dev`     |
| API ビルド           | `pnpm --filter @rensoo/api build`   |
| API 起動（ビルド後） | `pnpm --filter @rensoo/api start`   |

## テスト / 品質

- **ユニット / 統合（Vitest）**: 連想生成・停止条件・編集・認可など重点ロジックに絞ってテストします。`pnpm test`
  で全パッケージ分を実行します（共有パッケージのビルドを含みます）。
- **E2E（Playwright）**: `apps/web/e2e/` にハッピーパスを置きます。API は spec 内でモックするため、実 LLM・実 Supabase は不要です。
  初回は `pnpm --filter @rensoo/web exec playwright install chromium` でブラウザを導入してから `pnpm --filter @rensoo/web e2e` を実行します。
- **CI ゲート**（[`.github/workflows/ci.yml`](.github/workflows/ci.yml)）:
  - `verify` ジョブ — 型チェック・ESLint・Vitest・ビルドを実行。
  - `e2e` ジョブ — 共有ビルド後に Playwright（chromium）を実行。
- 品質は **TypeScript strict**・ESLint（Flat Config）・Prettier（`pnpm format` が CI でも確認されます）で担保します。

テストの考え方は [`docs/philosophy/TEST_PHILOSOPHY.md`](docs/philosophy/TEST_PHILOSOPHY.md) を参照してください。

## データベース / 認証

- 永続化は **Supabase（PostgreSQL）** を利用します。マップは `public.mindmaps` テーブルに、生成設定・ノード/エッジの
  スナップショットを JSONB で保持します。
- 認可は **RLS（行レベルセキュリティ）** で本人のみアクセス可能に制御します（AC-11）。サーバーはユーザーの JWT を
  JWKS で検証し、その JWT を引き継いで Supabase にアクセスすることで RLS を効かせます。
- マイグレーションは [`supabase/migrations/`](supabase/migrations/) にあります（テーブル定義と RLS を関心分離で 2 ファイルに分割）。
  ローカルへの適用は Supabase CLI（例: `supabase db push`／`supabase migration up`）で行います。

テーブル定義・制約・RLS ポリシーは [`docs/DATABASE.md`](docs/DATABASE.md)、認証フローは [`docs/DESIGN.md`](docs/DESIGN.md) の §7 を参照してください。

## ドキュメント

設計フェーズの成果物は `docs/` に集約されています。実装はこれらを正とします。

| ドキュメント                                                                   | 内容                                                             |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)                                 | 背景・目的・ユーザーストーリー・FR/NFR・受け入れ条件（AC-1〜13） |
| [`docs/FEASIBILITY.md`](docs/FEASIBILITY.md)                                   | 各要件の実現可能性判定と一次情報の根拠                           |
| [`docs/TECH_STACK.md`](docs/TECH_STACK.md)                                     | 技術選定（採用技術・比較・バージョン・全体像）                   |
| [`docs/DESIGN.md`](docs/DESIGN.md)                                             | アーキテクチャ（レイヤ・拡張点 IF・API・自走展開フロー）         |
| [`docs/DATABASE.md`](docs/DATABASE.md)                                         | DB 設計（テーブル・制約・RLS・マイグレーション・ER 図）          |
| [`docs/DIRECTORY_STRUCTURE.md`](docs/DIRECTORY_STRUCTURE.md)                   | フォルダ／ファイル階層・配置ルール                               |
| [`docs/TASKS.md`](docs/TASKS.md)                                               | 実装タスク分解（T01〜T16・トレーサビリティ）                     |
| [`docs/GIT_CONVENTIONS.md`](docs/GIT_CONVENTIONS.md)                           | Git 運用（1 機能=1 ブランチ=1 PR・Conventional Commits）         |
| [`docs/philosophy/PLAN_PHILOSOPHY.md`](docs/philosophy/PLAN_PHILOSOPHY.md)     | 設計思想（拡張性・変動点の抽象化・依存方向は内向き）             |
| [`docs/philosophy/CODING_PHILOSOPHY.md`](docs/philosophy/CODING_PHILOSOPHY.md) | 実装思想（型厳格・エラー明示・スキーマ検証・秘密はサーバー側）   |
| [`docs/philosophy/TEST_PHILOSOPHY.md`](docs/philosophy/TEST_PHILOSOPHY.md)     | テスト思想（重点を絞る）                                         |
| [`CLAUDE.md`](CLAUDE.md)                                                       | 実装ガイド・運用ルールの索引                                     |

## トラブルシューティング

- **API が起動直後に落ちる / `環境変数 ANTHROPIC_API_KEY が設定されていません` と出る**
  `apps/api` の必須環境変数 `ANTHROPIC_API_KEY` が未設定です。サーバー側の環境変数として設定してください。
- **ログイン・保存・一覧が動かない**
  Supabase 関連の環境変数（サーバーの `SUPABASE_URL`/`SUPABASE_ANON_KEY`、フロントの `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`）が
  未設定だと認証・保存系は無効化され、ゲスト機能のみ動作します。保存系を使うにはサーバー側で両方を揃えてください。
- **型エラー: `@rensoo/shared` が見つからない / 型が解決できない**
  共有パッケージが未ビルドの可能性があります。`pnpm build:shared` を実行してください（`pnpm typecheck`・`pnpm test` は内部で実行します）。
- **E2E が起動しない / ブラウザが無いと言われる**
  初回は `pnpm --filter @rensoo/web exec playwright install chromium` でブラウザを導入してから `pnpm --filter @rensoo/web e2e` を実行してください。
- **CORS でフロントから API を呼べない**
  サーバーの `WEB_ORIGIN` にフロントのオリジンを設定してください（未指定は全許可で、本番では非推奨）。

## ライセンス

ライセンスは未設定です（リポジトリに `LICENSE` ファイルがありません）。
