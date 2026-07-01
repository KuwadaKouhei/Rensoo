# Rensoo ディレクトリ構造設計書 (DIRECTORY_STRUCTURE)

- ステータス: ドラフト（STEP2 設計 / ディレクトリ構造）
- 最終更新: 2026-06-26
- 上位設計: docs/DESIGN.md（§1 レイヤ／§2 コンポーネント／§3 拡張点／§5 API）
- 採用技術: docs/TECH_STACK.md（Vite+React+Zustand+React Flow / Hono on Node / Supabase / Zod / Vitest）
- DB 構成: docs/DATABASE.md（`supabase/` 配下のマイグレーション / `mindmaps` 1テーブル＋RLS）
- 準拠する思想: docs/philosophy/PLAN_PHILOSOPHY.md（拡張性・変動点の抽象化・依存方向は内向き・過剰設計の回避）/ CODING_PHILOSOPHY.md / TEST_PHILOSOPHY.md
- 命名・scope 整合: docs/GIT_CONVENTIONS.md（scope: association / mindmap / auth / persistence / ui / api）

---

## 0. この設計書の位置づけ

DESIGN.md が確定した「論理的なコンポーネント分割・拡張点・依存方向」を、**実際のフォルダ／ファイル階層**へ
落とし込む。本書のゴールは次の2点に集約される。

1. **可読性**: どこに何があるかが名前から分かり、目的のファイルに迷わず辿り着ける。
2. **拡張性**: 「新しい〇〇を足すとき、どこに何を追加するか」が一意に決まり、既存の配置ルールが壊れない。

実装はまだ存在しない（docs のみ）。本書はゼロから構造を定義する。

---

## 1. 構造の基調（決定）

### 1.1 リポジトリ形態: 単一リポジトリ内の軽量モノレポ（pnpm workspaces）

| 候補 | 内容 | 採否 |
|---|---|---|
| **A. ルート直下に2ディレクトリ並置**（`web/` と `api/` を並べ、共有は相互コピー/相対参照） | 最小構成 | △ 共有型（Zod スキーマ・ドメイン IF）の置き場が曖昧になり、フロント/サーバーで型がズレるリスク |
| **B. 軽量モノレポ（pnpm workspaces, `apps/*` + `packages/*`）** | フロント=`apps/web`、API=`apps/api`、共有=`packages/shared` | **採用** |
| C. Turborepo/Nx 等のモノレポツール | タスクキャッシュ・依存グラフ管理 | × 個人開発 MVP には重厚（過剰設計の回避） |

**採用 = B（pnpm workspaces による軽量モノレポ）。理由:**

- DESIGN/TECH_STACK が「**フロントとサーバーで Zod スキーマ・型・ドメイン IF を共有する**」と明記している（CODING_PHILOSOPHY「外部 I/O は同一スキーマで検証」）。共有コードの**唯一の置き場**として `packages/shared` を1箇所に定めれば、フロント/サーバー間の型ズレを構造的に防げる（可読性・整合性）。
- フロント／API が**別デプロイ**（Cloudflare Pages / Render）でも、1リポジトリなら PR・CI・型チェックを横断でき、`1機能=1PR` の縦スライス（PLAN_PHILOSOPHY / GIT_CONVENTIONS）がフロント＋サーバー＋共有型をまたいで1 PR に収まる。
- ツールは pnpm workspaces のみ（Turborepo 等を足さない）。個人開発 MVP に見合うシンプルさを保つ（過剰設計の回避）。

> **逸脱の有無**: なし。FW（Vite/Hono）はいずれもモノレポ標準と親和し、各 app 内は各 FW の標準レイアウトを保つ。

### 1.2 各 app/package の基調（レイヤー型 × 機能型のハイブリッド）

DESIGN.md §1.3 の「**依存方向は内向き（ドメインは FW/SDK/DB に依存しない）**」を物理構造で表現するため、
**ドメイン中核はレイヤー型で隔離し、その外側は機能（feature）型で割る**ハイブリッドを基調とする。

| 対象 | 基調 | 根拠 |
|---|---|---|
| **`packages/shared`** | レイヤー型（domain / schema を明確に分離） | ドメイン IF・モデル・Zod スキーマという「内側」を物理的に1箇所へ隔離し、外側から依存される中心にする |
| **`apps/api`（Hono）** | レイヤー型を主軸（domain → app(orchestration) → infra → http） | DESIGN §1.3 の依存性逆転（IF はドメイン側、実装は外側）を層ディレクトリで強制する。Hono 標準（薄い）に逆らわない |
| **`apps/web`（React）** | 機能（feature）型を主軸（features/ 配下を縦スライス）＋ store はドメイン中核として隔離 | DESIGN §2.1。Zustand ストアは「UI 非依存のフロントドメイン中核」なので feature から切り出して隔離。Vite/React に標準レイアウトの縛りはなく、feature 縦スライスが拡張に最適 |

**なぜ純レイヤー型にしない／純機能型にしないか:**

- 純レイヤー型のみ（`controllers/ services/ models/` を全体で1セット）にすると、機能が増えたとき各層に横断的にファイルが散らばり「1機能の全体像」が掴みにくい（可読性低下）。
- 純機能型のみ（すべて `features/` 配下）にすると、依存方向を内向きに保つべき「ドメイン中核（IF・純粋ロジック・ストア）」が feature に溶け込み、依存性逆転が崩れる。
- よって **「内側（ドメイン中核）はレイヤーで隔離」「外側は feature/scope で縦割り」** のハイブリッドが、可読性と依存方向の両立に最適。

---

## 2. 可読性ルール

### 2.1 命名規約

| 対象 | 規約 | 例 |
|---|---|---|
| ディレクトリ名 | **小文字 kebab-case**、複数形は「集合」を表すときのみ | `association/`, `mind-map/`, `providers/` |
| React コンポーネントファイル | **PascalCase**、1ファイル1コンポーネント | `MindMapCanvas.tsx`, `SaveDialog.tsx` |
| フック | `use` 接頭辞 + camelCase | `useExpansionStream.ts` |
| Zustand ストア | `xxxStore.ts` | `mindMapStore.ts` |
| 純粋ロジック/関数モジュール | camelCase の動詞/名詞 | `normalizeAssociations.ts`, `shouldStopExpansion.ts` |
| 型・インターフェース定義モジュール | camelCase（型名自体は PascalCase） | `associationProvider.ts`（`AssociationProvider` を定義） |
| Zod スキーマモジュール | `xxxSchema.ts` / 末尾 `Schema` のエクスポート | `associationSchema.ts` → `associateRequestSchema` |
| テスト | 対象と同階層に `*.test.ts(x)` | `shouldStopExpansion.test.ts` |
| Hono ルート | `xxx.routes.ts` | `maps.routes.ts`, `associations.routes.ts` |
| ドメイン語 | 日本語ドメイン語の英訳で統一（CODING_PHILOSOPHY） | `associationWord`, `mindMapNode`, `expansion` |

- **scope 語彙を命名の背骨にする**: GIT_CONVENTIONS の scope（`association` / `mindmap` / `auth` / `persistence` / `ui` / `api`）を、ディレクトリ名・モジュール名の第一語彙として使う。コミット scope とディレクトリが一致し、「どの PR がどこを触るか」が名前で対応する。

### 2.2 1ディレクトリ1責務

- 1ディレクトリは1つの責務（=1つの scope または1つの層）だけを持つ。`utils/` `common/` `misc/` `helpers/` のような**責務の曖昧なゴミ箱ディレクトリを作らない**（§4.3 の共有抑制ルールで強制）。
- 「機能 A と機能 B の両方で使うが、まだドメインでない小道具」は、**まず使う側の feature 内に置く**。2箇所目で必要になった時点で初めて昇格を検討する（§4.3）。

### 2.3 階層の深さ

- **`apps/*` 配下のソース階層は原則4段まで**（例: `apps/api/src/http/routes/maps.routes.ts` = `src` から3段）。
- これを超えそうになったら「分割し過ぎ」か「責務が混在」のサイン。命名で表現できるなら階層を増やさずファイル名で区別する。
- 空ディレクトリ・`index.ts` だけのディレクトリを「将来用」に先置きしない（過剰設計の回避）。必要になってから掘る。

### 2.4 テスト・型の同居 / 分離

- **テストは対象と同居**（co-location）。`shouldStopExpansion.ts` の隣に `shouldStopExpansion.test.ts` を置く。TEST_PHILOSOPHY の「重点ロジックを素早く回す」「AC 番号を紐づける」に対し、対象とテストが隣接していると変更時の追従が容易（可読性）。
- **型は使う場所の近くに置く**。ただし**フロント／サーバーをまたいで共有する型・スキーマは必ず `packages/shared`**（唯一の置き場）。app ローカルでしか使わない型は app 内に置く。
- E2E（Playwright）だけは性質が異なるため `apps/web/e2e/` に分離（co-location しない）。

### 2.5 index / barrel の方針

- **package の公開境界（`packages/shared/src/index.ts`）にのみ barrel を置く**。これが「shared の公開 API」を明示し、内部構造の変更を外から隠す。
- **app 内部では barrel（`index.ts` 再エクスポート集約）を原則作らない**。barrel は循環参照・ツリーシェイク阻害・「どこから来た import か不明」を招きやすいため、app 内は**実体ファイルを直接 import** する（可読性・依存の追跡性を優先）。

---

## 3. 拡張性ルール

### 3.1 依存方向（import 規約・ESLint で強制を検討）

DESIGN §1.3 / §2.3 の内向き依存を、**ディレクトリ間 import 規約**として明文化する。
矢印 `A → B` は「A は B を import してよい」。逆向きは禁止。

```
apps/web ──┐
           ├─→ packages/shared (domain + schema)   ← 内側。何にも依存しない
apps/api ──┘

# apps/api 内部（内向き）:
http/  ─→ app/ ─→ domain/        （domain は app/http/infra を import しない）
infra/ ─→ domain/(IF を実装)       （infra は http/app を import しない）
app/   ─→ domain/(IF にのみ依存)   （具体実装 infra/ を直接 import しない＝DI で注入）

# apps/web 内部（内向き）:
features/ ─→ store/ ─→ (packages/shared の domain)
features/ ─→ api-client/ ─→ (packages/shared の schema)
store/    ─→ 何も UI を import しない（プレーン TS）
```

**強制したい不変条件（DESIGN §2.3 由来）:**

1. `packages/shared/src/domain/**` は `hono` / `@anthropic-ai/sdk` / `@supabase/supabase-js` / `react` を import しない（ESLint `no-restricted-imports` で検討）。
2. `apps/api/src/domain/**` も同上（FW・SDK 非依存）。
3. `apps/api/src/app/**`（オーケストレーション）は `domain/` の**インターフェースにのみ依存**し、`infra/` の具体実装を直接 import しない（コンストラクタ DI で注入）。
4. `apps/web/src/store/**` は React コンポーネントを import しない（UI 非依存のプレーン TS）。

### 3.2 拡張点の物理配置（最重要 — DESIGN §3 の3拡張点）

DESIGN.md が限定した**3つの拡張点**それぞれに、抽象（IF）と実装（具体）の置き場を一意に定める。

| 拡張点 | 抽象（IF / 型 / 純粋ロジック）の置き場 | 実装の置き場 | 「足す」とき |
|---|---|---|---|
| **AssociationProvider**（連想ソース） | `packages/shared/src/domain/association/associationProvider.ts`（IF・`AssociationWord`・`AssociateRequest`・`AssociationProviderError`）＋ `normalizeAssociations.ts`（整形・純粋関数） | `apps/api/src/infra/providers/claudeAssociationProvider.ts` | **新プロバイダ = `apps/api/src/infra/providers/` に1ファイル追加**し、DI 登録を1行変える。IF・ドメインは無改変 |
| **MindMapRepository**（永続化） | `packages/shared/src/domain/persistence/mindMapRepository.ts`（IF・`MindMapSummary`・`MindMapSnapshot`） | `apps/api/src/infra/repositories/supabaseMindMapRepository.ts` | **新ストレージ = `apps/api/src/infra/repositories/` に1ファイル追加**し DI 差し替え |
| **layout()**（描画レイアウト） | `apps/web/src/mindmap-layout/layout.ts`（`LayoutFn` 型・`LayoutInput`・`PositionedNode`） | `apps/web/src/mindmap-layout/dagreLayout.ts`（第一）/ `elkLayout.ts`（差替先） | **新レイアウト = `apps/web/src/mindmap-layout/` に1ファイル追加**し供給関数を差し替え |

**配置原則:**

- **抽象（IF・型・純粋ロジック）は「内側」へ**。`AssociationProvider` / `MindMapRepository` はフロント・サーバー双方が型として参照しうる（フロントは `MindMapSnapshot` 型を保存リクエストに使う）ため `packages/shared/src/domain/` に置く（依存性逆転の中心）。
- **実装（外部詳細を触る）は「外側」へ**。Anthropic SDK / Supabase クライアントを触る実装は `apps/api/src/infra/` に隔離する。infra 配下を見れば「外部サービスとの接点」が一望できる。
- **`layout()` はフロント固有**（React Flow の座標計算でサーバー不要）なので shared に上げず `apps/web` 内に置く（過剰共有の回避）。
- **「連想ソースを LLM 以外（辞書 API 等）に足す」**（PLAN_PHILOSOPHY 明記の将来要件）も、`AssociationProvider` の別実装を `infra/providers/` に追加するだけで成立する（IF が LLM 固有でないため）。

### 3.3 新機能の追加先（一意に決まること）

| 追加したいもの | 追加先（一意） |
|---|---|
| 新しい API エンドポイント | `apps/api/src/http/routes/<scope>.routes.ts`（既存 scope なら追記、新 scope なら新ファイル）＋ I/O スキーマは `packages/shared/src/schema/<scope>Schema.ts` |
| 新しいオーケストレーション処理（純粋でない調整） | `apps/api/src/app/<scope>/`（例: `expansion/`） |
| 新しいドメイン純粋ロジック（FW 非依存） | `apps/api/src/domain/<scope>/` または共有なら `packages/shared/src/domain/<scope>/` |
| 新しい外部サービス実装 | `apps/api/src/infra/<種別>/`（`providers/` `repositories/` 等） |
| 新しい UI 画面 | `apps/web/src/features/<feature>/` を新設し、ルートを `apps/web/src/app/routes.tsx` に登録 |
| 新しい UI 部品（feature 横断の純粋表示部品） | shadcn/ui プリミティブは `apps/web/src/components/ui/`、独自の薄い部品は `apps/web/src/ui/`（いずれもロジックを持たない） |
| 新しいフロントドメイン状態・操作 | `apps/web/src/store/` の既存ストアに追記、または新ストアファイル |

### 3.4 共有（shared / common）の肥大化抑制

- `packages/shared` に置けるのは **「フロントとサーバーの双方が実際に参照するもの」だけ**（型・Zod スキーマ・ドメイン IF・ドメイン純粋ロジック）。片側しか使わないものは置かない。
- `packages/shared` の内部は **`domain/`（IF・モデル・純粋ロジック）と `schema/`（Zod）に二分**し、それ以外のカテゴリを増やさない。`shared/utils` を作らない。
- **昇格ルール（app ローカル → shared）**: 「2つ目の app で必要になった」かつ「外部詳細（FW/SDK）に依存しない」を**両方満たしたときだけ** shared へ昇格する。1箇所でしか使わない／FW 依存があるものは app 内に留める。
- **分割ルール**: `domain/` 配下が肥大化したら scope（`association/` `mind-map/` `persistence/`）でサブディレクトリに割る。「機能横断の雑多な置き場」は作らない。

---

## 4. 全体ディレクトリツリー

```
Rensoo/
├── apps/
│   ├── web/                          # フロントエンド（React SPA / Vite）
│   │   ├── public/                   # 静的アセット（favicon 等）
│   │   ├── index.html                # Vite エントリ HTML
│   │   ├── src/
│   │   │   ├── main.tsx              # アプリ起動（React DOM マウント）
│   │   │   ├── app/                  # アプリ骨格（ルーティング・プロバイダ・レイアウト）
│   │   │   │   ├── App.tsx
│   │   │   │   ├── routes.tsx        # React Router のルート定義（/ ＝ホーム, /map ＝編集）
│   │   │   │   └── useTheme.ts       # ダーク/ライトのテーマ切替（.dark クラス・localStorage・M6）
│   │   │   ├── pages/                # 画面コンテナ（ルートに対応・M6/T18）。features を組み立てるだけ
│   │   │   │   ├── HomePage.tsx      # ホーム画面（ヒーロー＋一覧/紹介）
│   │   │   │   └── EditorPage.tsx    # マインドマップ編集画面
│   │   │   ├── components/           # shadcn/ui プリミティブ（ui/）＋画面横断レイアウト（layout/）
│   │   │   │   ├── ui/               # Button/Input/Card 等（リポジトリ内に所有）
│   │   │   │   └── layout/           # AppHeader 等（M6）
│   │   │   ├── features/             # 機能（縦スライス）。1 feature = 1画面/機能単位
│   │   │   │   ├── mind-map/         # マップ編集・描画（DESIGN §2.1）
│   │   │   │   │   ├── MindMapCanvas.tsx        # React Flow 描画（store から供給）
│   │   │   │   │   ├── MindMapToolbar.tsx       # 作成/自動・手動トグル/停止
│   │   │   │   │   ├── NodeEditPopover.tsx      # ノード追加/編集/削除UI
│   │   │   │   │   ├── useExpansionStream.ts    # SSE 受信フック
│   │   │   │   │   └── *.test.tsx
│   │   │   │   ├── generation-settings/         # 生成設定UI（件数/停止条件）
│   │   │   │   │   └── GenerationSettingsPanel.tsx
│   │   │   │   └── auth-save/        # 認証導線・保存/一覧/開く/削除UI
│   │   │   │       ├── SaveDialog.tsx
│   │   │   │       ├── MapListPanel.tsx
│   │   │   │       └── LoginButton.tsx
│   │   │   ├── store/                # フロントドメイン中核（Zustand・UI非依存）
│   │   │   │   ├── mindMapStore.ts   # ノード/エッジ/モード/進行状態＋整合ロジック
│   │   │   │   └── mindMapStore.test.ts
│   │   │   ├── api-client/           # 型付きfetch + Zod検証 + SSE + エラー日本語化
│   │   │   │   ├── client.ts
│   │   │   │   ├── associations.ts
│   │   │   │   ├── maps.ts
│   │   │   │   └── errors.ts         # APIエラー→日本語メッセージ変換
│   │   │   ├── mindmap-layout/       # 拡張点: layout()（Dagre/ELK 差替）
│   │   │   │   ├── layout.ts         # LayoutFn 型・入出力型
│   │   │   │   ├── dagreLayout.ts    # 第一実装
│   │   │   │   └── dagreLayout.test.ts
│   │   │   ├── auth/                 # Supabase Auth クライアント（認証のみ）
│   │   │   │   └── supabaseClient.ts
│   │   │   └── ui/                   # 汎用プレゼンテーション部品（ロジックなし）
│   │   │       └── Button.tsx
│   │   ├── e2e/                      # Playwright（ハッピーパス1〜2本のみ）
│   │   ├── vite.config.ts
│   │   ├── vitest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/                          # APIサーバー（Hono on Node.js）
│       ├── src/
│       │   ├── index.ts             # @hono/node-server 起動・DI 配線（実装注入）
│       │   ├── http/                # 外側: ルーティング層（Hono 依存をここに閉じ込め）
│       │   │   ├── app.ts           # Hono インスタンス・CORS・共通ミドルウェア
│       │   │   ├── routes/
│       │   │   │   ├── associations.routes.ts  # POST /api/associations
│       │   │   │   ├── expansion.routes.ts     # POST /api/expansion/stream (SSE)
│       │   │   │   ├── maps.routes.ts          # /api/maps CRUD
│       │   │   │   └── health.routes.ts        # GET /api/health
│       │   │   ├── middleware/
│       │   │   │   └── auth.ts      # JWT を JWKS(ES256) でローカル検証
│       │   │   └── errors.ts        # 型付きエラー→HTTP+日本語メッセージ写像
│       │   ├── app/                 # オーケストレーション層（IFのみ依存・DI注入）
│       │   │   └── expansion/
│       │   │       ├── expansionOrchestrator.ts  # BFS/停止/多重実行抑制/レート制御
│       │   │       ├── rateLimiter.ts            # 並列度制限・指数バックオフ
│       │   │       └── expansionOrchestrator.test.ts
│       │   ├── domain/              # 内側: APIサーバー固有のドメイン純粋ロジック
│       │   │   └── expansion/
│       │   │       ├── shouldStopExpansion.ts    # 停止判定（純粋関数・最重点テスト）
│       │   │       └── shouldStopExpansion.test.ts
│       │   └── infra/               # 外側: 外部サービス実装（IF を実装）
│       │       ├── providers/       # 拡張点: AssociationProvider 実装
│       │       │   ├── claudeAssociationProvider.ts
│       │       │   └── claudeAssociationProvider.test.ts
│       │       └── repositories/    # 拡張点: MindMapRepository 実装
│       │           └── supabaseMindMapRepository.ts
│       ├── vitest.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   └── shared/                       # フロント/サーバー共有（内側・依存される中心）
│       ├── src/
│       │   ├── domain/              # ドメインIF・モデル・純粋ロジック（FW/SDK非依存）
│       │   │   ├── association/
│       │   │   │   ├── associationProvider.ts   # IF + AssociationWord/Request/Error
│       │   │   │   ├── normalizeAssociations.ts  # 整形（重複/空/件数調整・純粋）
│       │   │   │   └── normalizeAssociations.test.ts
│       │   │   ├── mind-map/
│       │   │   │   └── model.ts      # MindMapNode/MindMapEdge/MindMapSnapshot 型
│       │   │   └── persistence/
│       │   │       └── mindMapRepository.ts      # IF + MindMapSummary
│       │   ├── schema/              # Zod スキーマ（フロント/サーバー/LLM応答 共通）
│       │   │   ├── associationSchema.ts          # associateRequestSchema 等
│       │   │   ├── generationSettingsSchema.ts   # countPerNode/maxDepth/maxNodes
│       │   │   ├── mapSchema.ts                  # 保存系 I/O・snapshot 形状
│       │   │   └── llmResponseSchema.ts          # LLM 構造化出力の二重検証用
│       │   └── index.ts            # 公開境界（barrel はここだけ）
│       ├── tsconfig.json
│       └── package.json
│
├── supabase/                         # DB（DATABASE.md で確定済み）
│   ├── config.toml
│   └── migrations/
│       ├── 20260626090000_create_mindmaps.sql
│       └── 20260626090100_mindmaps_rls.sql
│
├── docs/                             # 設計ドキュメント群（既存）
│   ├── REQUIREMENTS.md
│   ├── FEASIBILITY.md
│   ├── TECH_STACK.md
│   ├── DESIGN.md
│   ├── DATABASE.md
│   ├── DIRECTORY_STRUCTURE.md        # ← 本書
│   ├── GIT_CONVENTIONS.md
│   └── philosophy/
│       ├── PLAN_PHILOSOPHY.md
│       ├── CODING_PHILOSOPHY.md
│       └── TEST_PHILOSOPHY.md
│
├── .github/
│   └── workflows/
│       └── ci.yml                    # tsc --noEmit / ESLint / Vitest（CIゲート）
│
├── pnpm-workspace.yaml               # apps/* と packages/* をワークスペース登録
├── package.json                      # ルート（共通 scripts・devDeps）
├── tsconfig.base.json                # 共通 TS 設定（strict）。各 tsconfig が extends
├── eslint.config.js                  # Flat Config（import 制限ルール含む）
├── .prettierrc
├── .gitignore                        # .env* / 認証情報を必ず除外（GIT_CONVENTIONS）
└── README.md
```

---

## 5. 主要ディレクトリの責務表

### 5.1 `apps/web`（フロントエンド）

| ディレクトリ | 責務 | 依存してよい先 | DESIGN 対応 |
|---|---|---|---|
| `src/app/` | アプリ骨格（ルーティング・全体プロバイダ・レイアウト）。ロジックは持たない | features, store, ui | §2.1 |
| `src/features/<feature>/` | 1機能の縦スライス（画面・その機能専用フック/部品）。ドメイン操作は store に委譲 | store, api-client, ui, mindmap-layout, shared | §2.1 マップ編集/生成設定/認証・保存 UI |
| `src/store/` | **フロントドメイン中核**。ノード/エッジ/モード/進行状態の保持＋エッジ整合ロジック。UI 非依存のプレーン TS | shared(domain) のみ | §2.1 Zustand ストア（モックなしでテスト） |
| `src/api-client/` | 型付き fetch・Zod 検証・SSE 受信・エラー日本語化・再試行 | shared(schema) | §2.1 APIクライアント |
| `src/mindmap-layout/` | **拡張点 layout()**。Dagre 第一・ELK 差替先。純粋関数 | shared(domain mind-map 型) | §3.3 layout() |
| `src/auth/` | Supabase Auth クライアント（ログイン・JWT 取得）。認証のみ | @supabase/supabase-js | §2.1 認証 UI の足回り |
| `src/ui/` | 汎用プレゼンテーション部品（ロジックを持たない見た目部品）。既存の薄い部品はここ、または `components/ui/` のプリミティブを包む | components/ui, lib | 共有 UI 抑制の受け皿 |
| `src/components/ui/` | **shadcn/ui プリミティブ**（Button/Input/Card/Dialog 等・リポジトリ内にコピーして所有）。Tailwind＋cva＋Radix。ロジックは持たない | lib（`cn`）, Radix, cva | §2.5.1 スタイリング基盤（M6） |
| `src/lib/` | UI 補助ユーティリティ（`cn`＝clsx＋tailwind-merge 等）。純粋関数 | clsx, tailwind-merge | §2.5.1 スタイリング基盤（M6） |
| `src/index.css` | Tailwind ディレクティブ＋デザイントークン（CSS 変数/`@theme`）。全画面共通の見た目の源泉 | - | §2.5.1 トークン（M6） |
| `e2e/` | Playwright ハッピーパス（1〜2本） | - | TEST_PHILOSOPHY |

### 5.2 `apps/api`（APIサーバー）— レイヤーと依存方向

| ディレクトリ | 層 | 責務 | import してよい先 | DESIGN 対応 |
|---|---|---|---|---|
| `src/http/` | 外側 | Hono ルーティング・CORS・認証ミドルウェア・SSE・エラー→HTTP 写像。**Hono 依存をここに閉じ込める** | app, domain, shared | §2.2 ルーティング層・認証ミドルウェア・§5 |
| `src/app/` | 中間 | オーケストレーション（BFS・停止判定呼び出し・多重実行抑制・レート制御）。**IF にのみ依存し DI で実装注入** | domain, shared（IF） | §2.2 連想オーケストレーション層・§6 |
| `src/domain/` | 内側 | API サーバー固有のドメイン純粋関数（`shouldStopExpansion` 等）。FW/SDK 非依存 | shared | §6.3 停止条件（最重点テスト） |
| `src/infra/providers/` | 外側 | **拡張点 AssociationProvider 実装**。Anthropic SDK 呼び出し・API キー秘匿 | shared（IF）, @anthropic-ai/sdk | §3.1 ClaudeAssociationProvider |
| `src/infra/repositories/` | 外側 | **拡張点 MindMapRepository 実装**。ユーザー JWT 引き継ぎ Supabase アクセス（RLS） | shared（IF）, @supabase/supabase-js | §3.2 SupabaseMindMapRepository |
| `src/index.ts` | 起動 | サーバー起動＋**DI 配線**（どの実装を注入するか1箇所に集約） | http, app, infra | §2.3 DI 注入 |

> `app/`（オーケストレーション）が `infra/`（具体実装）を**直接 import しない**点が肝。実装の選択は `src/index.ts` の DI 配線でのみ行う。これにより「Claude→OpenAI 差し替え」が `index.ts` 1箇所＋`infra/providers/` への1ファイル追加で完結する。

### 5.3 `packages/shared`（共有・内側の中心）

| ディレクトリ | 責務 | 制約 |
|---|---|---|
| `src/domain/association/` | `AssociationProvider` IF・`AssociationWord`/`AssociateRequest`/`AssociationProviderError`・`normalizeAssociations`（整形・純粋） | FW/SDK/React を import 禁止 |
| `src/domain/mind-map/` | `MindMapNode`/`MindMapEdge`/`MindMapSnapshot`/`GenerationSettings` などドメインモデル型 | 同上 |
| `src/domain/persistence/` | `MindMapRepository` IF・`MindMapSummary` | 同上 |
| `src/schema/` | Zod スキーマ（API I/O・生成設定・LLM 応答・snapshot 形状）。**フロント/サーバー/LLM 検証で共用** | Zod のみに依存 |
| `src/index.ts` | 公開境界（barrel）。shared の外向き API を明示 | ここだけ barrel 可 |

### 5.4 ルート・横断

| パス | 責務 |
|---|---|
| `supabase/` | DB スキーマ・RLS マイグレーション（DATABASE.md で確定）。前方追記運用 |
| `.github/workflows/ci.yml` | 型チェック・ESLint・Vitest をゲート化（TEST_PHILOSOPHY / GIT_CONVENTIONS） |
| `tsconfig.base.json` | strict 等の共通 TS 設定。各 app/package が extends |
| `eslint.config.js` | Flat Config。§3.1 の依存方向を `no-restricted-imports` で強制 |
| `.gitignore` | `.env*`・認証情報を除外（CLAUDE.md / GIT_CONVENTIONS 厳守） |

---

## 6. 自己検証（拡張手順に迷いが出ないか）

DESIGN/タスクで予見される3つの拡張を、本構造に実際に当てはめる。**各ステップで「触る場所が一意」かを確認**する。

### 例1: 連想 Provider に OpenAI を追加する（PLAN_PHILOSOPHY 最重要拡張点）

1. `apps/api/src/infra/providers/openaiAssociationProvider.ts` を**新規追加**し、`packages/shared` の `AssociationProvider` IF を実装する。
2. `apps/api/src/index.ts` の DI 配線で、注入する実装を `ClaudeAssociationProvider` → `OpenAiAssociationProvider`（または環境変数で分岐）に**1行差し替え**。
3. **無改変**: `packages/shared/src/domain/`（IF・`normalizeAssociations`）、`apps/api/src/app/`（オーケストレーション）、`apps/web` 全体。

→ 触る場所は「`infra/providers/` への1ファイル追加」＋「`index.ts` の DI 1行」。**迷いなし**。整形・停止条件・UI に波及しない（依存方向が内向きであることの実証）。

### 例2: マップ共有機能を追加する（将来要件）

共有は「新エンドポイント＋新画面＋場合により永続化変更」を伴う複合機能。本構造での割り付け:

1. **API**: `apps/api/src/http/routes/sharing.routes.ts` を新設（scope=`sharing`）。共有リンク発行ロジックが純粋でなければ `apps/api/src/app/sharing/` に置く。
2. **スキーマ**: 共有 I/O の Zod を `packages/shared/src/schema/sharingSchema.ts` に追加（フロント/サーバー共用）。
3. **永続化**: 共有用に「ノード横断クエリ」が必要なら DATABASE.md §9 の通り正規化へ移行するが、**ドメインから見れば `MindMapRepository` の拡張**で吸収。実装変更は `apps/api/src/infra/repositories/` 内に閉じる。
4. **フロント**: `apps/web/src/features/sharing/` を新設し、`app/routes.tsx` にルート登録。共有ボタンは `features/mind-map/` のツールバーから呼ぶ。

→ 各成果物の置き場が scope ごとに一意に決まる。既存 feature・既存 IF を壊さない。**迷いなし**。

### 例3: 新しい画面（例: マップ閲覧の全画面プレビュー）を追加する

1. `apps/web/src/features/map-preview/` を**新規作成**し、画面コンポーネント・専用フックをその中に閉じる。
2. ルートを `apps/web/src/app/routes.tsx` に1行登録。
3. ドメイン状態が要れば `apps/web/src/store/` に追記（新規ストアか既存ストア拡張）。表示専用なら store 不要。
4. 汎用部品が要れば `apps/web/src/ui/` に置く。

→ 「画面 = `features/<feature>/` を1つ足す」が固定ルール。**迷いなし**。他 feature と独立して縦に足せる（PLAN_PHILOSOPHY 縦スライス）。

### 検証まとめ

3例とも「追加先ディレクトリが一意」「既存の配置ルールを壊さない」「依存方向が保たれる」ことを確認した。
特に拡張点（Provider/Repository/layout）は **抽象を内側（shared/domain）・実装を外側（infra や mindmap-layout）** に分離したことで、実装追加が局所で完結する。

---

## 7. 思想・FW 標準からの逸脱と理由

| 項目 | 判断 | 逸脱の有無・理由 |
|---|---|---|
| モノレポ採用 | pnpm workspaces | **逸脱なし**。共有スキーマ/IF の唯一化（型ズレ防止）と縦スライス 1PR の両立のため。ツールは最小限（Turborepo 不採用） |
| api を純レイヤー型にしない | レイヤー×scope ハイブリッド | **逸脱なし**。依存方向の強制（レイヤー）と機能可読性（scope）の両立。Hono は薄く標準レイアウトを縛らないため整合 |
| web を機能型中心にしつつ store を隔離 | store/ を features から分離 | **逸脱なし**。DESIGN §2.1「Zustand は UI 非依存のフロントドメイン中核」を物理的に表現するため、あえて feature 内に置かない |
| app 内で barrel を使わない | 実体直 import | **FW 慣習からの軽微な選択**。理由: 循環参照・追跡性低下を避ける（可読性優先）。公開境界 `packages/shared/src/index.ts` のみ barrel を許可 |
| `layout()` を shared に上げない | web 内に配置 | **逸脱なし**。フロント固有でサーバー不要。過剰共有の回避（shared 肥大化抑制） |
| `utils/`/`common/` を作らない | 禁止 | **逸脱なし**。責務の単一性（PLAN/CODING）。共有は domain/schema の2カテゴリに限定 |

> DESIGN.md / DATABASE.md / TECH_STACK.md と矛盾しない。`supabase/` 構成は DATABASE.md §4.1 をそのまま採用。
> 拡張点は DESIGN §3 の3つ（AssociationProvider / MindMapRepository / layout）に限定し、それ以外の投機的ディレクトリは作らない（過剰設計の回避）。

---

## 付録: 関連ドキュメント

- 要件: docs/REQUIREMENTS.md
- アーキテクチャ設計: docs/DESIGN.md
- DB 設計: docs/DATABASE.md
- 技術選定: docs/TECH_STACK.md
- 設計思想: docs/philosophy/PLAN_PHILOSOPHY.md
- 実装思想: docs/philosophy/CODING_PHILOSOPHY.md
- テスト思想: docs/philosophy/TEST_PHILOSOPHY.md
- Git 運用: docs/GIT_CONVENTIONS.md
