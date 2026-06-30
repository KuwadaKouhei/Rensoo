# Rensoo タスク分解 (TASKS)

- ステータス: ドラフト（STEP3 タスク分解 / 全6フェーズ）
- 最終更新: 2026-06-26
- 上位入力: docs/DESIGN.md / docs/REQUIREMENTS.md（AC-1〜13） / docs/DATABASE.md / docs/DIRECTORY_STRUCTURE.md
- Git 運用: docs/GIT_CONVENTIONS.md（1タスク=1機能=1ブランチ=1PR、`feature/<タスクID>-<slug>`、Conventional Commits）
- テスト方針: docs/philosophy/TEST_PHILOSOPHY.md（重点＝連想生成・停止条件・編集・認可を縦スライス内でユニット＋主要フロー統合）

---

## 0. この文書の使い方

- 本一覧が **実装フェーズ（STEP4）の駆動表**。上から順に着手すれば、各タスクのマージ時点で `main` が
  グリーン（ビルド・型チェック・重点テスト通過）を保てる縦スライス順に並べてある。
- 各タスクは **1機能=1ブランチ=1PR**。ブランチは `推奨ブランチ名` で切る。
- テスト専用タスクは作らない。**各タスクの「やること」にテストを含める**（縦スライス内でテストも書く）。
- 「対応AC / 対応要件」は受け入れ条件（AC-1〜13）・FR/NFR への紐づけ。どの AC も最低1タスクで満たす（§3 トレーサビリティ参照）。

---

## 1. マイルストーン（実装順の大枠）

| M | 名称 | 含むタスク | 到達状態（main がグリーンで満たすこと） |
|---|---|---|---|
| **M0** | 基盤 | T01, T02, T03, T04 | モノレポ・共有スキーマ/IF・DB マイグレ・連想 Provider 土台が揃い CI が回る |
| **M1** | 最小価値フロー | T05, T06, T07 | キーワード→単発生成→マインドマップ描画（ゲスト）が画面で動く（AC-1,2 / 一部 AC-8） |
| **M2** | 自走展開 | T08, T09, T10 | 自動連鎖（停止条件で自動停止）・手動展開・自動/手動トグル・停止操作（AC-3,4,5,6） |
| **M3** | ノード手動編集 | T11 | ノード追加/編集/削除・孤立エッジ除去（AC-7） |
| **M4** | 認証＆保存 | T12, T13, T14 | OAuth ログイン・保存時ログイン要求・一覧/取得/再編集/削除・本人限定（AC-9,10,11、AC-8 確定） |
| **M5** | 仕上げ | T15, T16 | エラー/再試行の一貫日本語化・性能/可観測性・CI ゲート強化（AC-12,13、NFR 群） |

> PoC（Claude 連想品質/レイテンシ・自走展開コスト/429）は専用タスクに切り出さず、**T04（連想 Provider）と T08（自走展開）の「やること」に内包**する（早い段階で実測し、結果を `docs/FEASIBILITY.md` に追記）。

---

## 2. タスク一覧（実装順）

### T01: モノレポ初期化・CI 雛形

- **概要**: pnpm workspaces の軽量モノレポを初期化。`apps/web`・`apps/api`・`packages/shared` の雛形、
  TS strict 共通設定、ESLint(Flat Config, import 制限の骨子)・Prettier、`.gitignore`（`.env*` 除外）、
  GitHub Actions CI（`tsc --noEmit` / ESLint / Vitest）を用意する。各 app は「最小の起動可能な空アプリ」まで。
- **対応AC / 対応要件**: 直接の AC なし（全タスクの土台）／ NFR-5(`.env` 除外), NFR-7 の前提, GIT_CONVENTIONS, DIRECTORY_STRUCTURE §4
- **主な変更場所**: ルート（`pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `eslint.config.js`,
  `.prettierrc`, `.gitignore`）, `.github/workflows/ci.yml`, 各 `apps/web`・`apps/api`・`packages/shared` の
  `package.json`/`tsconfig.json` 雛形, `apps/web/index.html`+`src/main.tsx`(空画面), `apps/api/src/index.ts`(空起動)
- **やること（テスト含む）**: ルートで `pnpm -r build` / `tsc --noEmit` が通る。Vitest が各 package で起動し、
  ダミーの sanity テスト1本が green。CI がこの3ゲートを実行して PR をブロックできること。
- **依存タスク**: なし
- **推奨ブランチ名**: `feature/T01-monorepo-init`
- **状態**: done（実装済み。型チェック / ESLint / Vitest(各1本) / ビルドの4ゲートが green）

### T02: 共有スキーマ・ドメイン IF（packages/shared）

- **概要**: フロント/サーバー/LLM 検証で共用する Zod スキーマと、ドメイン IF・モデル・純粋整形ロジックを
  `packages/shared` に定義する。`AssociationProvider` IF と `normalizeAssociations`（整形・純粋関数）、
  `MindMapRepository` IF、マップモデル型、各 Zod スキーマ、公開 barrel(`src/index.ts`) を整備。
- **対応AC / 対応要件**: AC-1,2,5,7,9,10,11,13 の型基盤（DESIGN §3.1/§3.2/§5.5）／ FR-4,5, NFR-7
- **主な変更場所**: `packages/shared/src/domain/association/`（`associationProvider.ts`, `normalizeAssociations.ts`+test）,
  `packages/shared/src/domain/mind-map/model.ts`, `packages/shared/src/domain/persistence/mindMapRepository.ts`,
  `packages/shared/src/schema/`（`associationSchema.ts`, `generationSettingsSchema.ts`, `mapSchema.ts`, `llmResponseSchema.ts`）,
  `packages/shared/src/index.ts`
- **やること（テスト含む）**: DESIGN §5.5 の Zod スキーマ（associateRequest / generationSettings / llmAssociationResponse /
  保存系 I/O・snapshot 形状）を実装。`normalizeAssociations` の**重点ユニットテスト**（入力語自身の除去・空白/重複除去・
  count 超過トリム・不足許容）を書く。ESLint の import 制限（domain は hono/anthropic/supabase/react を import しない）を有効化。
- **依存タスク**: T01
- **推奨ブランチ名**: `feature/T02-shared-schema-domain`
- **状態**: done（Zod スキーマ・ドメイン IF・モデル・`normalizeAssociations`（6ケース）・孤立エッジ検証（3ケース）を実装し4ゲート green。domain の import 制限を ESLint で有効化）

### T03: Supabase スキーマ・RLS マイグレーション

- **概要**: `supabase/` を初期化し、`mindmaps` テーブル（JSONB スナップショット案）と
  `updated_at` トリガ、index、RLS 4ポリシー（本人限定 CRUD）をマイグレーションとして作成する。
- **対応AC / 対応要件**: AC-9,10,11（DB 層の認可）／ FR-19,21,22, NFR-6, DATABASE §2/§3/§4
- **主な変更場所**: `supabase/config.toml`,
  `supabase/migrations/20260626090000_create_mindmaps.sql`（テーブル・index・トリガ）,
  `supabase/migrations/20260626090100_mindmaps_rls.sql`（RLS 有効化・4ポリシー）
- **やること（テスト含む）**: DATABASE §2.3/§3.2 の DDL/ポリシーをそのまま実装。`supabase db reset` で頭から
  再適用でき再現性が取れること。**RLS の回帰テスト方針**（別ユーザー2人で「自分のは見える/他人のは見えない」）を
  T13 の統合テストへ橋渡しできる形でドキュメント化（このタスクでは SQL 適用と reset 再現性まで）。
- **依存タスク**: T01
- **推奨ブランチ名**: `feature/T03-supabase-migrations`
- **状態**: done（DATABASE §2.3/§3.2 の DDL・index・トリガ・RLS 4ポリシーをマイグレーション化＋config.toml を作成。実 DB での `supabase db reset` 再現性と RLS 回帰テストは Docker/CLI 環境を要するため T13 統合テストで検証する旨を migration 内に明記）

### T04: ClaudeAssociationProvider＋単発生成 API（PoC 内包）

- **概要**: `AssociationProvider` の Claude 実装と、`POST /api/associations`（単発生成・認証任意）を実装。
  LLM 応答を Zod で二重検証し `normalizeAssociations` で整形して返す。API キーはサーバー環境変数のみ。
  あわせて **PoC（連想品質・件数追従・重複/無関係率・p50/p95 レイテンシ）を実測**し FEASIBILITY に追記。
- **対応AC / 対応要件**: AC-1,2,13／ FR-1,2,3,4,5, NFR-1,5, NFR-7, DESIGN §3.1/§5.3/§5.5/§8.2
- **主な変更場所**: `apps/api/src/infra/providers/claudeAssociationProvider.ts`(+test),
  `apps/api/src/http/routes/associations.routes.ts`, `apps/api/src/http/app.ts`(Hono/CORS/zod-validator),
  `apps/api/src/http/errors.ts`(型付きエラー→HTTP+日本語写像), `apps/api/src/http/routes/health.routes.ts`,
  `apps/api/src/index.ts`(DI 配線)
- **やること（テスト含む）**: 構造化出力＋Zod 二重検証。件数厳密一致はアプリ側で担保。`AssociationProviderError`
  （rate_limit/timeout/invalid_response/upstream/unknown・retryable）を定義し握りつぶさず再スロー。
  **ユニット**: provider の応答整形（モック応答→normalize 通過）、エラー分類。**統合**: `/api/associations` の
  正常系＋検証 400＋上流失敗 502/429。API キーがレスポンス/ログに出ないことを確認。`/api/health` を追加。
- **依存タスク**: T01, T02
- **推奨ブランチ名**: `feature/T04-claude-association-api`
- **状態**: done（ClaudeAssociationProvider＋`POST /api/associations`＋`/api/health`＋エラー写像＋DI 配線を実装。provider 8 / route 8 のテストで応答整形・エラー分類・正常/検証400/429/502・エラー応答に内部情報を含まないことを検証し4ゲート green。**実 LLM での PoC 実測（品質・p50/p95 レイテンシ・429 当たり）は `ANTHROPIC_API_KEY` のある環境が必要なため未実施**＝鍵のある環境で実行し FEASIBILITY に追記する。構造化出力は MVP ではプロンプト指定JSON＋Zod厳格検証で代替し、`output_config.format` 導入余地を残す）

### T05: フロント基盤＋API クライアント＋マップストア土台

- **概要**: フロントのアプリ骨格（ルーティング・レイアウト）、型付き API クライアント（Zod 検証・
  エラー日本語化・再試行）、Zustand マップストア（ノード/エッジ/モード/進行状態＋追加・整合の素地）を用意する。
- **対応AC / 対応要件**: AC-1,12 の足回り／ FR-6,7, NFR-7,8,11, DESIGN §2.1
- **主な変更場所**: `apps/web/src/app/`（`App.tsx`, `routes.tsx`）, `apps/web/src/api-client/`（`client.ts`,
  `associations.ts`, `errors.ts`）, `apps/web/src/store/`（`mindMapStore.ts`+test）, `apps/web/src/ui/Button.tsx`
- **やること（テスト含む）**: API クライアントは shared の Zod でレスポンス検証、error→日本語メッセージ変換、
  `retryable` 判定を持つ。**ストアの重点ユニットテスト**（連想結果を子ノード＋エッジとして取り込む整合ロジック、
  起点ノード生成）。UI 非依存のプレーン TS としてモックなしでテスト可能にする。
- **依存タスク**: T01, T02
- **推奨ブランチ名**: `feature/T05-web-foundation-store`
- **状態**: done（Zustand マップストア（純粋関数 `createRootMap`/`appendAssociations` ＋ store・起点生成/子取り込み整合/重複・空白除去/孤立エッジ防止/モード・設定・進行状態を 17 ケースで検証）、型付き API クライアント（`client`/`associations`/`errors`：shared の Zod で送受信検証・サーバー日本語メッセージ透過・`retryable` 判定・ネットワーク/非JSON/スキーマ不一致を ApiError に正規化）、アプリ骨格（`App`/`routes`＋`react-router-dom`）、`ui/Button`、`vite-env.d.ts` を実装し4ゲート green。連想 API の応答契約 `associateResponseSchema` を `packages/shared` に追加してフロント/サーバーで共有。実画面（キーワード→作成→描画）は T07 で本ホームに実装）

### T06: マインドマップ描画（React Flow＋layout 拡張点）

- **概要**: React Flow による描画コンポーネントと、`layout()` 拡張点（Dagre 第一実装）を実装。
  ストアからノード/エッジを供給し、ズーム/パン・自動配置・ノードクリック検知を提供する。
- **対応AC / 対応要件**: AC-1（描画）／ FR-7,8,9, NFR-2, DESIGN §2.1/§3.3
- **主な変更場所**: `apps/web/src/features/mind-map/MindMapCanvas.tsx`,
  `apps/web/src/mindmap-layout/`（`layout.ts`, `dagreLayout.ts`+test）
- **やること（テスト含む）**: React Flow 内蔵 state にドメインを握らせず Zustand から供給（描画ライブラリ分離）。
  `dagreLayout` の**ユニットテスト**（入力ノード/エッジ→座標が決定的に返る・親子の上下関係）。数十ノードで
  破綻しないレイアウト。クリックで対象ノード ID をストア/ハンドラに伝える。
- **依存タスク**: T05
- **推奨ブランチ名**: `feature/T06-mindmap-render-layout`
- **状態**: done（`layout()` 拡張点（`layout.ts` の `LayoutFn`/`LayoutInput`/`PositionedNode`）と Dagre 第一実装（`dagreLayout.ts`：純粋関数・中心→左上原点変換）を実装。`MindMapCanvas.tsx` は React Flow（`@xyflow/react`）描画で、ノード/エッジを Zustand から供給し座標は layout() で都度算出（描画ライブラリ分離・内蔵 state にドメインを握らせない）、ズーム/パンは標準機能、`onNodeSelect` でクリック対象 ID をハンドラへ伝達（手動展開は T08 で配線）。`dagreLayout` を 6 ケース（全ノード座標・決定性・TB 親子上下/LR 親子左右・40 ノード破綻なし・孤立起点）で検証し4ゲート green。ホームに Canvas を全画面表示（入力 UI は T07）。React Flow 同梱で web バンドルが ~510kB（gzip ~162kB）に増加＝コード分割は M5/T15 の性能仕上げで対応予定）

### T07: キーワード入力→作成→単発生成→描画（縦貫通・ゲスト）

- **概要**: ツールバーのキーワード入力＋「作成」ボタンと生成設定 UI（件数 3〜10/既定6）を実装し、
  T04 の API・T05 ストア・T06 描画を結線。ゲストで「入力→作成→起点＋連想ノード表示」が動く最小価値フロー。
- **対応AC / 対応要件**: AC-1,2,8(一部),12／ FR-1,4,6, NFR-11, DESIGN §2.1/§6.1
- **主な変更場所**: `apps/web/src/features/mind-map/MindMapToolbar.tsx`,
  `apps/web/src/features/generation-settings/GenerationSettingsPanel.tsx`,
  `apps/web/src/api-client/associations.ts`(結線), `apps/web/src/store/mindMapStore.ts`(作成アクション)
- **やること（テスト含む）**: 件数設定（Zod 範囲検証・既定6）が**次回生成に追従**（AC-2）。生成中ローディング表示、
  失敗時は日本語エラー＋再試行（AC-12 の単発分）。**統合/コンポーネントテスト**: 「作成」で起点＋1件以上の
  日本語ノードが描画される（AC-1）、件数変更が反映される（AC-2）。
- **依存タスク**: T04, T05, T06
- **推奨ブランチ名**: `feature/T07-create-flow-vertical`
- **状態**: done（生成フロー `createAssociationMap`（起点生成→生成中表示→API 連想取得（件数は `settings.countPerNode` に追従）→子取り込み、失敗は ApiError の日本語 message／想定外は汎用文＋ログで status=error）を実装し、T04 API・T05 ストア・T06 描画を結線。`MindMapToolbar`（入力＋「作成」、生成中はローディング表示・入力/ボタン無効化、エラー時に日本語メッセージ＋再試行）、`GenerationSettingsPanel`（件数 3〜10 を shared Zod で範囲検証）、ホームに操作 UI を Canvas へ重ねて配置。**統合テスト 6 ケース**（作成で起点＋連想ノード描画=AC-1／件数追従=AC-2／生成中 generating→完了 idle／API 失敗の日本語 error=AC-12／想定外フォールバック＋ログ／空入力は API 非呼び出し）。ストアは純粋なまま保ち API 境界のみスタブ（TEST_PHILOSOPHY「主要フローの統合テスト＋外部依存スタブ」に準拠し、jsdom コンポーネントテストは採らずフロー統合テストで AC を担保）。4ゲート green（型/Lint/Vitest shared9・api16・**web29**/ビルド）。**マイルストーン M1 完了**＝ゲストで「入力→作成→マインドマップ表示」が画面で動く。バンドル ~513kB は M5/T15 でコード分割予定）

### T08: 自走展開オーケストレータ＋SSE（停止条件・コスト保護／PoC 内包）

- **概要**: `POST /api/expansion/stream`（SSE）と BFS オーケストレータ、停止判定純粋関数
  `shouldStopExpansion`、多重実行抑制（ロック）・レート制御（並列度制限＋指数バックオフ）を実装。
  **自走展開のコスト/コール数/429 を PoC 実測**し FEASIBILITY に追記。
- **対応AC / 対応要件**: AC-3,6,12／ FR-10,13,14, NFR-1,3,4,8, DESIGN §6.2〜§6.5
- **主な変更場所**: `apps/api/src/http/routes/expansion.routes.ts`(SSE),
  `apps/api/src/app/expansion/`（`expansionOrchestrator.ts`+test, `rateLimiter.ts`）,
  `apps/api/src/domain/expansion/shouldStopExpansion.ts`(+test), `apps/api/src/index.ts`(DI)
- **やること（テスト含む）**: キュー投入前に停止判定（深さ・総ノード上限）。**最重点ユニット**: `shouldStopExpansion`
  の境界値（maxDepth+1、maxNodes ちょうど）。**統合**: SSE で node-batch/progress/stopped/error が流れ、停止条件で
  自動停止（AC-3）、接続クローズで以降の LLM 呼び出しが発生しない（AC-6）。多重実行は 409/無視。コスト上限が
  サーバー側で常に効くことを確認（NFR-3）。
- **依存タスク**: T04
- **推奨ブランチ名**: `feature/T08-expansion-orchestrator-sse`
- **状態**: done（停止判定純粋関数 `shouldStopExpansion`（depth 優先・上限ちょうど境界）、BFS オーケストレータ `runExpansion`（キュー投入前に停止判定／`normalizeAssociations` 整形／マップ全体のグローバル重複除去／上限を超えて生成しない／中断 `signal.aborted` で追加 LLM 呼び出しせず user_stop／失敗は SSE error＋日本語・内部情報なし）、レート制御 `withRetry`（再試行可能エラーのみ指数バックオフ・上限・sleep 注入）、多重実行ロック `InMemoryExpansionLock`、SSE ルート `POST /api/expansion/stream`（Zod 検証→ロック取得（多重実行 409）→`streamSSE` で node-batch/progress/stopped/error 送出・`onAbort` で中断）を実装。共有契約 `expansionSchema`（リクエスト＋SSE イベント＋イベント名）を追加。**テスト**: shouldStopExpansion 7（最重点境界値）／rateLimiter 6／orchestrator 8（AC-3 停止・NFR-3 上限厳守・AC-6 中断で LLM 非呼出・重複除去・error 写像）／SSE ルート 4（イベント列・400・409 多重実行・キー独立）。4ゲート green（型/Lint/Vitest shared9・**api41**・web29/ビルド）。**実 LLM での自走展開 PoC（コスト/コール数/p95/429）は `ANTHROPIC_API_KEY` のある環境が必要なため未実施＝鍵のある環境で実行し FEASIBILITY に追記**。node-batch はフロント整合のためサーバー採番 id を含める軽微な具体化（schema に明記）。SSE 接続クローズによる実停止のブラウザ E2E は T13/手動確認に橋渡し）

### T09: フロント自走展開（SSE 受信・段階描画・停止）

- **概要**: SSE 受信フックでバッチ到着ごとにストア更新→`layout()`→React Flow 再描画。停止/一時停止操作（接続クローズ）
  と停止理由の表示を実装。自動モードでの「作成」を expansion/stream に接続する。
- **対応AC / 対応要件**: AC-3,6,12／ FR-10,14, NFR-1,2,8, DESIGN §6.2/§6.5
- **主な変更場所**: `apps/web/src/features/mind-map/useExpansionStream.ts`,
  `apps/web/src/features/mind-map/MindMapToolbar.tsx`(停止ボタン),
  `apps/web/src/store/mindMapStore.ts`(バッチ取り込み・進行状態), `apps/web/src/api-client/`(SSE 受信)
- **やること（テスト含む）**: SSE イベントを Zod 検証して取り込み。停止ボタンで接続クローズ→増加停止（AC-6）。
  停止理由（max_nodes/max_depth/user_stop）を日本語表示。**ユニット**: ストアのバッチ取り込み整合（親子エッジ・depth）。
  error イベントで日本語エラー＋再試行（AC-12）。
- **依存タスク**: T07, T08
- **推奨ブランチ名**: `feature/T09-web-expansion-stream`
- **状態**: done（SSE 受信クライアント `streamExpansion`（fetch ストリームを手動パース＝POST+ボディ対応、各フレームを shared Zod で検証して振り分け、AbortSignal で中断＝接続クローズ、非2xx は ApiError）、フロー `startExpansion`（clearMap→生成中→node-batch 取り込み→stopped で停止理由＋idle／error は日本語で error 維持／停止で stopped 未受信なら user_stop 確定）、`useExpansionStream` フック（AbortController で start/stop・アンマウントで abort）、ストアに純粋関数 `applyBatch`（サーバー採番 id・冪等・親→子エッジ）＋`applyExpansionBatch`/`setStopReason`/`clearMap`/`stopReason` を追加、`MindMapToolbar` を自走展開＋停止ボタン＋停止理由の日本語表示に更新。**テスト**: store applyBatch 3＋store アクション 3／runExpansionFlow 6（AC-3 段階描画・AC-2 設定追従・AC-12 error 維持・AC-6 user_stop 確定・409・空入力）／expansion.ts 6（SSE 解析・error・409・中断正常終了・スキーマ不一致無視・NETWORK）。4ゲート green（型/Lint/Vitest shared9・api41・**web47**/ビルド）。**マイルストーン M2 の中核（自動連鎖が画面で広がる）が成立**。自動/手動トグル UI と手動ノードクリック展開は T10。SSE 接続クローズの実ブラウザ停止確認は T13/手動に橋渡し）

### T10: 自動/手動トグル＋手動展開（連鎖しない）

- **概要**: 自動/手動モードのトグル（Zustand `mode`）と、手動展開（ノードクリックで `/api/associations` を1回呼び連鎖しない）
  を実装。モード切替が画面に反映され、自動の起動可否が状態に依存する。
- **対応AC / 対応要件**: AC-4,5／ FR-11,12, DESIGN §6.2
- **主な変更場所**: `apps/web/src/features/mind-map/MindMapToolbar.tsx`(トグル),
  `apps/web/src/features/mind-map/MindMapCanvas.tsx`(クリック→手動展開), `apps/web/src/store/mindMapStore.ts`(`mode`)
- **やること（テスト含む）**: 手動モードはクリックしたノードだけ 1 回生成し**連鎖しない**（AC-4）。トグルで自動/手動が
  切り替わり画面反映（AC-5）。**ユニット**: mode 分岐（自動=expansion、手動=単発、連鎖の有無）。**コンポーネント**:
  手動クリックで子ノードが1段だけ増える。
- **依存タスク**: T09
- **推奨ブランチ名**: `feature/T10-auto-manual-toggle`
- **状態**: done（手動展開フロー `expandNode`（手動モードのみ作用＝自動モードは no-op／生成中・未知ノードは no-op で多重実行と自動連鎖の競合を防止／対象ノードの語で `/api/associations` を**1回だけ**呼び `appendChildren` で子を1段追加＝**連鎖しない**／失敗は日本語 error）を実装。`MindMapToolbar` に自動/手動トグル（ラジオ・`setMode`）と作成分岐（自動=自走展開 SSE／手動=単発 createAssociationMap）、手動時の操作ガイド表示、停止ボタンは自動時のみ。`MindMapCanvas` の `onNodeSelect` を `expandNode` に配線（クリック→手動展開）。**テスト**: expandNode 6（手動で1段・連鎖なし=AC-4／子クリックで孫展開／自動は no-op=AC-5／生成中 no-op／未知ノード no-op／API 失敗の日本語 error）。4ゲート green（型/Lint/Vitest shared9・api41・**web53**/ビルド）。**マイルストーン M2 完了**＝自動連鎖・手動展開・トグル・停止が画面で動く（AC-3,4,5,6）。作成ボタンの mode 分岐は薄い結線のため build/typecheck＋expandNode/startExpansion/createAssociationMap の各テストで担保（jsdom コンポーネントテストは TEST_PHILOSOPHY に従い不採用）。SSE 接続クローズの実ブラウザ停止確認は T13/手動に橋渡し）

### T11: ノード手動編集（追加・編集・削除／孤立エッジ除去）

- **概要**: ノードの手動追加・テキスト編集・削除 UI と、削除時に孤立エッジを残さないストア整合ロジックを実装。
- **対応AC / 対応要件**: AC-7／ FR-15,16,17, DESIGN §2.1/§4.2, DATABASE §6.1
- **主な変更場所**: `apps/web/src/features/mind-map/NodeEditPopover.tsx`,
  `apps/web/src/store/mindMapStore.ts`(add/edit/remove＋エッジ整合)
- **やること（テスト含む）**: 削除時に対象ノードを source/target に持つエッジを除去（孤立エッジ禁止）。**重点ユニット**:
  追加/編集/削除後の nodes/edges 整合（孤立エッジが残らない・存在しないノードを指すエッジが生じない）。編集結果が描画反映（AC-7）。
- **依存タスク**: T06
- **推奨ブランチ名**: `feature/T11-node-manual-edit`
- **状態**: done（ストアに純粋関数 `addChildNode`（origin=manual・既存 id 衝突回避の採番・親なし/空テキストは throw）／`editNodeText`（空・未知ノードは throw・エッジ不変）／`removeNodeCascade`（**対象＋子孫を BFS で削除し接続エッジを除去＝孤立エッジも孤立ノードも残さない**・DATABASE §6.1 の snapshot 内整合）を実装し、`addChildNode`/`editNode`/`removeNode`/`selectNode`＋`selectedNodeId` をアクション化（削除時に選択中なら選択解除）。`NodeEditPopover`（選択ノードの展開・名前編集・子追加・削除）を実装し、`MindMapCanvas` クリック→ノード選択→ポップオーバー表示に配線。**重点ユニット**: 追加3／編集2／カスケード削除4（葉・中間で子孫消去・起点で全消去・未知は無変更、いずれも孤立エッジ無しを検証）＋ストアアクション4（反映・選択解除・別ノード削除で選択保持）。4ゲート green（型/Lint/Vitest shared9・api41・**web65**/ビルド）。**マイルストーン M3 完了**（AC-7）。編集 UI の描画反映は build/typecheck＋ストア整合テストで担保（jsdom コンポーネントテストは TEST_PHILOSOPHY に従い不採用）。クリック挙動を T10 の直接展開からノード選択（ポップオーバー内に「展開」ボタン）へ集約＝手動展開も AC-4 を維持）

### T12: 認証基盤（Supabase Auth＋JWKS 検証ミドルウェア）

- **概要**: フロントの Supabase Auth クライアント（Google OAuth ログイン・JWT 取得）と、API サーバーの
  認証ミドルウェア（JWKS/ES256 ローカル検証・`sub` 抽出、生成系=任意/保存系=必須）を実装。
- **対応AC / 対応要件**: AC-8(確定),9(検知の土台)／ FR-18,20, NFR-6, DESIGN §7.1〜§7.4
- **主な変更場所**: `apps/web/src/auth/supabaseClient.ts`, `apps/web/src/features/auth-save/LoginButton.tsx`,
  `apps/api/src/http/middleware/auth.ts`, `apps/api/src/http/app.ts`(ミドルウェア配線)
- **やること（テスト含む）**: JWKS を起動時取得＋kid ミス時再取得。保存系は JWT 必須（欠落/無効は 401 日本語）。
  生成系は任意（未認証可）でゲスト動作が壊れないことを確認（AC-8）。**ユニット**: JWT 検証（正常/期限切れ/改竄/欠落）の分類。
- **依存タスク**: T04
- **推奨ブランチ名**: `feature/T12-auth-jwks-middleware`
- **状態**: done（API 認証ミドルウェア `auth.ts`（`createJwksVerifier`＝jose `createRemoteJWKSet` で JWKS/ES256 をローカル検証・kid ミス時再取得／`requireAuth`＝欠落・無効は 401 日本語・成功で `userId` を Context に／`optionalAuth`＝未認証可・**無効トークンもゲスト続行**で生成を壊さない=AC-8・`AuthEnv` 型）を実装し、`createApp` に `jwtVerifier` を DI して生成系に optionalAuth を配線、`index.ts` で `SUPABASE_URL` から JWKS verifier を構築（未設定ならゲストのみ）。フロントは `auth/supabaseClient`（Google OAuth・`getAccessToken`・未設定なら null＝ゲスト専用）／`auth/useAuth`（セッション購読）／`features/auth-save/LoginButton`、オーバーレイに配置。**テスト**: 実 ES256 検証 4（正常/期限切れ/別鍵改竄/sub 欠落）＋ミドルウェア 6（requireAuth 欠落・無効・正常／optionalAuth 欠落・無効ゲスト・正常）。4ゲート green（型/Lint/Vitest shared9・**api51**・web65/ビルド）。保存系ハンドラ（requireAuth 適用）と RLS 引き継ぎは T13。フロント認証 UI は境界（OAuth/ネットワーク）のため jsdom テスト不採用＝build/typecheck で担保。実 Supabase での OAuth 疎通は鍵環境/手動・統合 T13 で確認）

### T13: 保存系 API（maps CRUD＋SupabaseMindMapRepository／RLS 統合テスト）

- **概要**: `MindMapRepository` の Supabase 実装と保存系エンドポイント（`GET /api/maps`・`GET /api/maps/:id`・
  `POST /api/maps`・`DELETE /api/maps/:id`、すべて認証必須）を実装。ユーザー JWT 引き継ぎで RLS を効かせる。
- **対応AC / 対応要件**: AC-10,11／ FR-21,22, NFR-6, DESIGN §3.2/§5.2/§5.3/§7.3, DATABASE §3/§7
- **主な変更場所**: `apps/api/src/infra/repositories/supabaseMindMapRepository.ts`,
  `apps/api/src/http/routes/maps.routes.ts`, `apps/api/src/index.ts`(DI), `packages/shared/src/schema/mapSchema.ts`(I/O 確認)
- **やること（テスト含む）**: 保存前に snapshot を Zod 検証（全 edge の source/target が node に存在＝孤立エッジ禁止）。
  新規/上書きは id 有無で分岐。`service_role` 不使用（ユーザー JWT 引き継ぎ）。**統合（最重点 認可）**: 別ユーザー2人で
  「自分のマップは一覧/取得/削除できる」「他人のマップは取得不可＝404/一覧に出ない」（AC-11）、保存→再取得で再編集可（AC-10）。
- **依存タスク**: T03, T12
- **推奨ブランチ名**: `feature/T13-maps-crud-repository`
- **状態**: done（`SupabaseMindMapRepository`（**ユーザー JWT 引き継ぎクライアント**＝`global.headers.Authorization` で RLS を効かせ `service_role` 不使用／list・get(null→404)・save(id 有無で update/insert 分岐・owner_id 明示・root_keyword は起点ノードから導出)・remove／DB エラーは握りつぶさず throw）と `createSupabaseRepositoryFactory`（リクエストごとに JWT バインド）を実装。保存系ルート `maps.routes`（`GET /api/maps`・`GET /api/maps/:id`・`POST /api/maps`・`DELETE /api/maps/:id`、全て `requireAuth`、保存前に `saveMapRequestSchema` で**孤立エッジ禁止**を Zod 検証、他人/不存在は 404、削除は 204）を `createApp` に DI 配線（verifier＋factory が揃った時のみ有効化）、`index.ts` で `SUPABASE_URL`＋`SUPABASE_ANON_KEY` から構築。auth ミドルウェアは検証済み `token` も Context に載せる。共有 IF に `SaveMindMapInput`（id 任意）を追加。ESLint に未使用 `^_`／rest 兄弟の無視規約を追加。**テスト**: 保存系ルート 8（**認可: 認証なし401／保存→一覧→取得で再編集=AC-10／上書き／他人は一覧非表示・取得404・削除しても残る=AC-11**／孤立エッジ400／不存在404／削除204→404）＋Repository マッピング 6（list/get(null)/insert・update 分岐・root_keyword 導出・DB エラー throw・remove）。4ゲート green（型/Lint/Vitest shared9・**api65**・web65/ビルド）。**実 Supabase での 2 ユーザー RLS 回帰（Docker/CLI 要）は本環境で未実施＝T03 から繰り越し**、ルートはインメモリ Repository で RLS 相当の本人限定を統合検証し、実 DB 検証はステージング/手動に橋渡し）

### T14: フロント保存導線（保存時ログイン要求・一覧・開く・削除）

- **概要**: 保存/一覧/開く/削除の UI と、ゲスト保存時にログインを要求する事前検知を実装。T13 の保存系 API と結線。
- **対応AC / 対応要件**: AC-9,10,11／ FR-19,21,22, NFR-11, DESIGN §7.1/§7.2
- **主な変更場所**: `apps/web/src/features/auth-save/`（`SaveDialog.tsx`, `MapListPanel.tsx`）,
  `apps/web/src/api-client/maps.ts`, `apps/web/src/store/mindMapStore.ts`(ロード/タイトル)
- **やること（テスト含む）**: 「保存」押下時に未ログインを検知しログイン要求（AC-9）、ログイン後に保存。一覧を更新日時順表示、
  選択で開いて再編集、削除で一覧から消える（AC-10）。他人のマップは API で 404 になり UI に出ない（AC-11 のフロント側確認）。
  **コンポーネント**: ゲスト保存→ログイン要求が出る、保存後に一覧へ反映。
- **依存タスク**: T13
- **推奨ブランチ名**: `feature/T14-web-save-flow`
- **状態**: done（保存系 API クライアント `api-client/maps`（list/get/save/delete・Authorization Bearer・応答を shared Zod で検証、`apiFetch` は 204/空ボディを許容）と保存導線フロー `features/auth-save/mapsFlow`（`saveCurrentMap`＝**未ログインは保存せず login-required=AC-9**／ログイン時は現在マップを保存し `mapId` を確定し以後は上書き=AC-10／空マップ非保存／API 失敗は日本語／`fetchMapList`・`openMap`＝取得→`loadMap` で再編集／`deleteMapById`＝開いていれば mapId 解除、いずれも getToken/client 注入可能）を実装。store に `title`/`mapId`＋`setTitle`/`loadMap` を追加（startNewMap/clearMap で id・タイトルもリセット）。UI: `SaveDialog`（タイトル＋保存・未ログインでログイン要求）/`MapListPanel`（ログイン時のみ一覧・開く・削除、保存後 reloadKey で再取得）をオーバーレイに配置。shared に `savedMapSchema`/`mapListResponseSchema` を追加。**テスト**: 保存導線フロー 11（AC-9 ログイン要求・AC-10 保存→mapId 確定/上書き/一覧/開いて再編集・AC-11 のフロント側=404 で開けず error・削除で mapId 解除・空マップ非保存・API 失敗日本語）。4ゲート green（型/Lint/Vitest shared9・api65・**web76**/ビルド）。**マイルストーン M4 完了**（認証＆保存・AC-9,10,11）。保存 UI 自体は build/typecheck＋フロー統合テストで担保（jsdom コンポーネントテストは TEST_PHILOSOPHY に従い不採用）。実 Supabase での OAuth＋RLS 通し確認はステージング/手動に橋渡し）

### T15: エラーハンドリング横断仕上げ＋シークレット秘匿確認

- **概要**: 全層のエラー写像（型付きエラー→HTTP→日本語メッセージ＋`retryable`）とフロントの再試行 UI を統一し、
  LLM/ネットワーク障害でもアプリが落ちないことを横断的に確認。API キー非露出を最終点検する。
- **対応AC / 対応要件**: AC-12,13／ FR-6, NFR-5,8, DESIGN §5.4/§8.1/§8.2
- **主な変更場所**: `apps/api/src/http/errors.ts`(写像の網羅), `apps/web/src/api-client/errors.ts`,
  各 feature の再試行 UI（`MindMapToolbar.tsx` 等）, ロギング（API キー/JWT をログに出さない）
- **やること（テスト含む）**: VALIDATION/UNAUTHORIZED/NOT_FOUND/RATE_LIMITED/UPSTREAM_LLM/INTERNAL を一貫日本語化、
  `retryable` で再試行ボタン表示。**統合**: 上流 429/502 で日本語エラー＋再試行・アプリ非クラッシュ（AC-12）。
  バンドル/ネットワーク/ログに Anthropic API キーが現れないことを点検（AC-13）。
- **依存タスク**: T07, T09, T14
- **推奨ブランチ名**: `feature/T15-error-handling-secrets`
- **状態**: todo

### T16: 仕上げ（性能・可観測性・E2E・CI ゲート強化）

- **概要**: 段階描画/レイアウトの再描画最小化（数十ノード滑らか）、構造化ログ（コール数・所要時間・停止理由、機微情報は除外）、
  ハッピーパス E2E（Playwright 1〜2本）、CI ゲート（型/Lint/Vitest/E2E）を確立する。
- **対応AC / 対応要件**: AC-1〜13 の回帰防止／ NFR-1,2, DESIGN §8.4/§8.5, TEST_PHILOSOPHY
- **主な変更場所**: `apps/web/e2e/`（Playwright）, `apps/web/src/features/mind-map/MindMapCanvas.tsx`(差分再描画),
  `apps/api`(構造化ログ), `.github/workflows/ci.yml`(E2E ゲート追加)
- **やること（テスト含む）**: 数十ノードで滑らか（NFR-2）、差分ノードへの layout 適用。**E2E**: 「キーワード→作成→自走展開→
  停止→（ログインして）保存→一覧から開く」のハッピーパス。CI が型/Lint/ユニット/統合/E2E をゲート化し `main` グリーンを保証。
- **依存タスク**: T09, T11, T14, T15
- **推奨ブランチ名**: `feature/T16-perf-observability-e2e`
- **状態**: todo

---

## 3. 受け入れ条件トレーサビリティ（AC → タスク）

| AC | 内容 | 主担当タスク | 補強タスク |
|---|---|---|---|
| AC-1 | 作成で起点＋1件以上の日本語連想ノード | T07 | T04, T05, T06 |
| AC-2 | 件数設定が次回生成に追従 | T07 | T02, T04 |
| AC-3 | 自動展開が停止条件で自動停止 | T08 | T09 |
| AC-4 | 手動展開は連鎖しない | T10 | T04 |
| AC-5 | 自動/手動トグルが画面反映 | T10 | T09 |
| AC-6 | 停止操作で増えない | T08, T09 | - |
| AC-7 | ノード追加/編集/削除・孤立エッジなし | T11 | T13(保存時検証) |
| AC-8 | ゲストで生成〜操作 | T12(確定) | T07, T09, T10, T11 |
| AC-9 | ゲスト保存でログイン要求 | T14 | T12, T13 |
| AC-10 | 保存・再ログイン後に一覧/再編集/削除 | T13, T14 | T03 |
| AC-11 | 他人のマップにアクセス不可 | T13 | T03, T14 |
| AC-12 | LLM 失敗で日本語エラー＋再試行・落ちない | T15 | T07, T09 |
| AC-13 | API キーがブラウザに露出しない | T04, T15 | T12 |

> 全 AC（1〜13）が最低1タスクで満たされ、どの AC も取りこぼしがないことを確認済み。

---

## 4. 依存関係グラフ（要約）

```
T01 ─┬─ T02 ─┬─ T04 ─┬─ T08 ─ T09 ─ T10
     │        │       ├─ T12 ─ T13 ─ T14
     │        ├─ T05 ─ T06 ─┬─ T07（← T04,T05,T06）
     │        │             └─ T11
     ├─ T03 ───────────────── T13
     └ ...
  仕上げ: T15（← T07,T09,T14） / T16（← T09,T11,T14,T15）
```

- **並行可能**: T03 は T01 完了後 T02/T04 と並行可。T05/T06（フロント描画系）と T08/T12（API 拡張系）は
  T04 完了後それぞれ並行で進められる。T11 は T06 完了後 M2 系と並行可。
- **クリティカルパス**: T01 → T02 → T04 → T08 → T09 → T10（自走展開フロー）／
  T01 → T03/T12 → T13 → T14（保存フロー）。

---

## 5. 完了条件（この分解の妥当性）

- 全機能（連想生成・描画・自走展開・手動編集・認証・保存・仕上げ）がタスクに分解されている。
- 各タスクに ID・概要・対応 AC/要件・主な変更場所・依存・推奨ブランチ名・状態がある。
- 実装順が依存を満たし、各タスクのマージ時点で `main` がグリーンを保てる縦スライス順になっている。
- 全 AC-1〜13 が §3 でタスクに紐づいている（取りこぼしなし）。

---

## 付録: 関連ドキュメント

- 要件: docs/REQUIREMENTS.md
- アーキテクチャ設計: docs/DESIGN.md
- DB 設計: docs/DATABASE.md
- ディレクトリ構造: docs/DIRECTORY_STRUCTURE.md
- Git 運用: docs/GIT_CONVENTIONS.md
- テスト思想: docs/philosophy/TEST_PHILOSOPHY.md
