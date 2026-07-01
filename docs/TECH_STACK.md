# Rensoo 技術選定書 (TECH_STACK)

- ステータス: ドラフト（STEP2 技術選定 / 全6フェーズ）
- 最終更新: 2026-06-26
- 対象要件: docs/REQUIREMENTS.md
- 実現可能性の前提: docs/FEASIBILITY.md
- 準拠する思想: docs/philosophy/PLAN_PHILOSOPHY.md（拡張性・変動点の抽象化）/ CODING_PHILOSOPHY.md（型厳格・エラー明示・シークレットはサーバー側）/ TEST_PHILOSOPHY.md（重要部分を絞る）
- 次フェーズ: STEP2 設計（docs/DESIGN.md / docs/DATABASE.md）

---

## 0. 前提と確定済み制約

本選定は、ユーザーが確定済みの以下の制約を尊重し、覆さない。各領域の選定はこの制約の内側で「類似候補と比較し、最適を選ぶ」形で行う。

1. **構成**: フロントエンド（React SPA）＋ **別の API サーバー**。フロントとバックエンドは分離する。LLM 呼び出しは API サーバー側に隠蔽し API キーを秘匿する（NFR-5 / AC-13）。
2. **データ/認証基盤**: **Supabase（BaaS）**。PostgreSQL ＋ 認証 ＋ RLS による本人限定アクセス（FR-22 / NFR-6 / AC-11）。
3. **LLM プロバイダ**: **Claude（Anthropic）**。ただし「入力語→連想語リスト」インターフェースの背後に隠し、他プロバイダへ差し替え可能な抽象層を設ける（PLAN_PHILOSOPHY 変動点の抽象化）。
4. **言語**: TypeScript（strict）。UI は日本語。モダンブラウザ・PC 主対象（NFR-9〜11）。

**既存資産**: 本プロジェクトは未実装（docs のみ存在、コードなし）。よって既存スタックとの整合制約はなく、要件・思想に最適なスタックをゼロから選定できる。逆に「チーム習熟」軸では個人開発＋本環境が Claude である点を重視する。

評価軸（PLAN_PHILOSOPHY の優先度＝拡張性最優先を反映した重み）:

| 軸 | 重み | 理由 |
|---|---|---|
| 要件適合 | 最高 | 受け入れ条件 AC を満たすことが大前提 |
| 拡張性・変動点の抽象化適性 | 高 | PLAN_PHILOSOPHY の最優先価値 |
| 型厳格・スキーマ検証との親和性 | 高 | CODING_PHILOSOPHY（strict / 外部入出力検証） |
| 成熟度・エコシステム・保守状況 | 中〜高 | 流行より安定。既知問題・ライセンスを直視 |
| 学習/習熟・実装容易性 | 中 | 個人開発。過剰な複雑さを避ける |
| コスト/ライセンス/無料枠 | 中 | 個人開発・コスト暴走回避（NFR-3） |
| ロックイン | 中 | Supabase/Claude は確定だが、抽象層で緩和する方針 |

---

## 1. アーキテクチャ全体像（選定の土台）

```
[ブラウザ: React SPA (Vite)]
   │  ① Supabase Auth (Google OAuth) で直接ログイン → JWT(アクセストークン)取得
   │  ② 連想生成/保存リクエスト（Authorization: Bearer <JWT>）
   ▼
[API サーバー: Hono on Node.js (TypeScript)]
   │  - JWT を JWKS(ES256) で検証して本人特定（保存系のみ必須・生成系は任意）
   │  - LLM オーケストレーション（自走展開BFS・停止条件・多重実行抑制・レート制御）
   │  - 連想ソース抽象層 AssociationProvider の背後に Claude を隠蔽
   │  - Anthropic API キーはサーバー環境変数のみ（フロントに出さない）
   ├─③ Anthropic API（Claude Haiku 4.5 / 構造化出力）
   └─④ Supabase(PostgreSQL)
         - 保存系: ユーザーJWTを引き継いだクライアントで RLS 経由アクセス（本人限定）
         - 管理系のみ service_role（限定利用）
```

ポイント:
- 認証は **フロントが Supabase Auth と直接やり取りしてトークンを取得**し、**そのトークンを別 API サーバーが JWKS で検証**する（FEASIBILITY 申し送りの「フロントで取得→別サーバーが検証」を具体化）。
- 自走展開の停止条件・レート制御・多重実行抑制は **API サーバーのオーケストレーション層の責務**（PLAN_PHILOSOPHY「コスト/暴走をアーキテクチャで制御」）。
- LLM は `AssociationProvider`（入力語→連想語リスト）の背後に隠す（変動点の抽象化）。

> 補足: FEASIBILITY では認証候補として Auth.js (NextAuth) を挙げていたが、これは Supabase 採用が確定する前の一般論。確定制約②に従い **Supabase Auth** を採用する（DB/認証基盤を一本化でき、RLS と auth.uid() が直結するため整合性が高い）。

---

## 2. 領域別の選定（選定技術 / 選定理由 / 類似技術との比較・不採用理由 / 出典）

### 2.1 言語: TypeScript（strict）— 確定制約

- **選定**: TypeScript 5.x、`tsconfig` で `strict: true`、`any` 原則禁止。フロント・API サーバーで言語統一。
- **選定理由**: CODING_PHILOSOPHY の「型でバグを未然に防ぐ／外部入出力はスキーマ検証して型付き値に」を満たす。フロント・サーバーで型（連想語・ノード・エッジ・生成設定・API I/O）を共有でき、境界をまたぐ整合性を型で担保できる。
- **比較・不採用**: 確定制約のため代替言語（Python 等）は比較対象外。ただし「API サーバーを TS で書くか別言語にするか」は 2.4 で検討し、TS 統一を採る。

### 2.2 フロントエンド ビルド/ツールチェーン: Vite

- **選定**: **Vite**（採用時点で安定の最新メジャー。2026-06 時点で Vite 8 が安定／Vite 7 も安定。実装着手時の最新安定版を採用、目安 v7〜v8）。React プラグインは `@vitejs/plugin-react`。
- **選定理由**: React SPA の事実上の標準ビルドツール。高速な dev サーバー（HMR）と素直な本番ビルド。TypeScript・ESM ネイティブで、後述の Vitest と設定を共有でき、テスト環境構築コストが最小（TEST_PHILOSOPHY と整合）。SPA（フロント／API 分離）に必要十分で、過剰な抽象を持ち込まない（PLAN_PHILOSOPHY「過剰設計の回避」）。
- **類似技術との比較**:
  - **Next.js**: フルスタック（API Routes / SSR）が魅力だが、本件は「フロントと API サーバーを分離する」確定制約①があり、Next の同居型 API は構成意図に反する。SSR も不要（認証付き SPA・PC 主対象）。MVP 規模に対して機能過多でロックインも大きく不採用。
  - **Create React App (CRA)**: 実質メンテ終了で非推奨。論外。
  - **Rsbuild / Parcel**: 動作はするがエコシステム・情報量・Vitest 連携で Vite が優位。差別化が弱く不採用。
- **出典**: https://vite.dev/blog/announcing-vite7 / https://vite.dev/blog/announcing-vite8 / https://github.com/vitejs/vite-plugin-react/releases

> バージョン注意: Vite 8 は Rolldown（Rust 製バンドラ）が既定の大型アーキ変更。安定版だが、プラグイン互換に不安があれば実装着手時に v7 で開始し v8 へ追従する判断でよい（既知問題はリリースノートで都度確認）。出典: https://vite.dev/blog/announcing-vite8

### 2.3 UI ライブラリ / ルーティング / 状態管理

#### React（UI）— 確定制約
- React 18+（採用時の最新安定）。React Flow が React 前提のため必然。

#### ルーティング: React Router
- **選定**: **React Router**（v6 系以降、SPA データルーター構成）。
- **選定理由**: 画面は「マップ編集」「保存一覧」「コールバック」程度で十分シンプル。SPA クライアントルーティングのデファクトで情報量・安定度が高い。
- **比較・不採用**: **TanStack Router**（型安全ルーティングが強力）は魅力だが、本件の画面数では型安全ルーティングの恩恵 < 学習/習熟コスト。小規模 MVP に対し過剰。**Next.js のファイルベースルーティング**は構成分離の制約上不採用（2.2）。

#### クライアント状態管理（連想マップの状態）: Zustand
- **選定**: **Zustand**（最新安定、約3KB）。連想マップのドメイン状態（ノード／エッジ／生成設定／自動・手動モード／展開ジョブの進行状態）を、UI 非依存のストアで保持する。
- **選定理由**:
  - 連想マップは「ノード追加・編集・削除」「自動／手動トグル」「停止条件到達で停止」など**頻繁かつ広域に更新される単一ドメイン状態**で、単一ストア型の Zustand と相性が良い。
  - PLAN_PHILOSOPHY「UI はドメインロジックを直接持たず、ロジックは UI 非依存」に沿い、状態とドメイン操作（追加／削除でエッジ整合 等）を**ストア（プレーン TS）に閉じ込め**、React Flow（描画）と分離できる。これは TEST_PHILOSOPHY の「純粋ロジックをモックなしでテスト」に直結（編集・停止条件のユニットテストがしやすい）。
  - ボイラープレートが少なく個人開発の速度に資する。TypeScript の型推論が良好。
- **類似技術との比較**:
  - **Redux Toolkit**: 構造化・DevTools が強いが ~15KB でボイラープレート多。本件規模では過剰で、PLAN_PHILOSOPHY の「MVP 規模に見合う構成」に反する。不採用。
  - **Jotai**: アトム単位の細粒度反応が強み。だが本件は「マップ全体という1つの大きな状態を一括操作」する性格が強く、細粒度アトムの恩恵が薄い。単一ストアで状態遷移を一望できる Zustand を優先。不採用（ただし思想的差は小さい）。
  - **React Context のみ**: 広域・高頻度更新で再レンダリングが膨らみやすく、数十ノード規模（NFR-2）で不利。状態管理ライブラリを置く。
  - **React Flow 内蔵ステート（useNodesState/useEdgesState）のみで完結させる案**: 描画ライブラリにドメイン状態を握らせると「ロジックの UI 非依存」原則（PLAN_PHILOSOPHY）と「描画ライブラリ差し替え余地」を損なう。**ドメイン状態は Zustand に置き、React Flow へはそこから供給する**方針を採る（React Flow 公式も Zustand 連携を案内）。
- **出典**: https://zustand.docs.pmnd.rs/learn/getting-started/comparison / https://dev.to/jsgurujobs/state-management-in-2026-zustand-vs-jotai-vs-redux-toolkit-vs-signals-2gge

#### サーバー状態（保存マップの取得・保存・一覧）: TanStack Query（任意・推奨）
- **選定**: **TanStack Query**（React Query）を保存系 API のデータ取得・キャッシュ・再試行に使う（任意採用、設計で最終判断）。
- **選定理由**: 一覧取得・保存・再取得（AC-10）の非同期状態（loading/error/retry）を宣言的に扱え、FR-6/AC-12 の「再試行できる UI」を素直に実装できる。クライアント状態（Zustand）とサーバー状態（Query）を分離すると見通しが良い。
- **不採用も可**: MVP の API 数が少ないため、Zustand ＋ 手書き fetch ラッパでも成立する。導入は設計時にコスト対効果で判断する（過剰設計回避）。

### 2.4 API サーバー（別サーバー本体）: Hono on Node.js

- **選定**: **Hono**（TypeScript ファースト Web フレームワーク）を **Node.js ランタイム**（`@hono/node-server`）上で動かす。
- **選定理由**:
  - **言語統一**: TS で書け、フロントと型・スキーマ（Zod）を共有できる（CODING_PHILOSOPHY）。型推論・型付きルーティングが強力。
  - **オーケストレーションを載せられる**: 自走展開（BFS・停止条件・多重実行抑制・レート制御）という**やや状態を持つ・やや長めの処理**を、ミドルウェアとサービス層で素直に構成できる。軽量で薄く、ドメイン層（連想オーケストレーション）を**フレームワーク非依存**に保ちやすい（依存方向は内向き＝PLAN_PHILOSOPHY）。
  - **拡張性・ポータビリティ**: Hono は Node / Bun / Deno / Cloudflare Workers / Lambda で同一コードが動く。将来ホスティングを変えても移植しやすく、変動点（インフラ）への耐性が高い。
  - **検証との親和**: `@hono/zod-validator` でリクエスト/レスポンスの Zod 検証を標準的に組める（NFR-7 / CODING_PHILOSOPHY「外部入出力はスキーマ検証」）。
- **なぜ「on Node.js」か（ランタイム判断・重要）**: Hono は Cloudflare Workers でも動くが、**Workers は CPU 10ms 制限・Node API 非互換**で、複数回の LLM 呼び出し・BFS・サーバー側ジョブ的な自走展開（NFR-3,4）には窮屈になりやすい。**まずは Node.js ランタイムで実装**し、制約の少ない環境でオーケストレーションを素直に書く。Hono を選ぶことで、将来 Edge へ寄せたくなった際の移植余地は残る（拡張性）。
- **類似技術との比較**:
  - **Fastify**: Node では高速・スキーマ（JSON Schema）駆動で堅実。だが TS 体験・型推論・将来のランタイム可搬性で Hono が上。Zod 中心の検証方針（2.7）とも Hono の方が噛み合う。性能差は本件の低トラフィックでは決定打にならない。次点として妥当だが不採用。
  - **Express**: 情報量は最大だが型は `@types` 頼みで品質ばら付き、ミドルウェアが古め。新規 TS プロジェクトで積極採用する理由が薄い。不採用。
  - **NestJS**: DI・モジュール・デコレータで大規模に強いが、MVP・個人開発には重厚で学習/習熟コスト過大。PLAN_PHILOSOPHY「過度なレイヤリングをしない」に反する。不採用。
  - **Supabase Edge Functions（Deno）だけで API を賄う案**: 構成は簡潔になるが、確定制約①「別の API サーバーを分離」の意図（独立したオーケストレーション層）と、自走展開の実行時間・状態管理の自由度で専用サーバーが有利。Edge Functions は補助用途に留める。
- **出典**: https://www.oflight.co.jp/en/columns/hono-vs-express-fastify-elysia-comparison-2026 / https://encore.dev/articles/nestjs-vs-fastify-vs-hono / https://hono.dev/docs/getting-started/nodejs / https://github.com/honojs/middleware/tree/main/packages/zod-validator

### 2.5 マインドマップ描画: React Flow (@xyflow/react) ＋ Dagre（自動レイアウト）

- **選定**: **@xyflow/react（React Flow）** を描画基盤に、自動レイアウトは **Dagre（@dagrejs/dagre）** を第一採用。必要に応じて **ELK（elkjs）** に差し替え可能な形にする。
- **選定理由**:
  - FEASIBILITY 検証ポイント2の通り、ノード/エッジ描画・ズーム/パン（FR-7,8）・クリック展開（FR-11）・自動レイアウト（FR-9）を直接満たす公式機能・例がある。
  - ノードを React コンポーネントで自由実装でき、日本語ノード UI・編集 UI（FR-15〜17）を作りやすい。数十ノード規模（NFR-2）は想定範囲内。
  - レイアウトは「`layout(graph, nodes, edges) → 配置済みノード`」という関数境界で抽象化し、Dagre/ELK を差し替え可能にする（PLAN_PHILOSOPHY 変動点の抽象化。FEASIBILITY 申し送りに準拠）。
- **Dagre を第一採用、ELK を次点とする理由**: 連想マップは「起点→子→孫」の**ツリー/有向グラフ**で、Dagre は木構造のレイアウトに対し**ドロップインで簡便・高速**。MVP の初速に最適。Dagre は現在メンテが活発でない点が唯一の懸念だが、出力品質は実用十分で広く使われており、より高機能・活発な **ELK へ関数境界ごと差し替え可能**にしておくことでリスクを吸収する。
- **類似技術との比較**:
  - **Cytoscape.js**: グラフ理論寄りで高機能だが React 親和性が低く、ノードを React で組む自由度が劣る。不採用。
  - **vis-network / D3 直書き**: D3 は自由度最大だが実装コスト大。React Flow が要件をカバーするため、車輪の再発明を避ける。不採用。
  - **レイアウトを d3-hierarchy にする案**: 木に特化し軽量だが、将来 DAG 的（再展開で合流）になった場合に Dagre/ELK の方が素直。Dagre を主、ELK を高機能側の差し替え先として確保。
- **出典**: https://reactflow.dev/learn/layouting/layouting / https://reactflow.dev/examples/layout/dagre / https://reactflow.dev/examples/layout/elkjs / https://reactflow.dev/examples/layout/expand-collapse

### 2.5.1 スタイリング / UI コンポーネント: Tailwind CSS ＋ shadcn/ui（M6 で追加）

- **選定**: **Tailwind CSS v4**（`@tailwindcss/vite` プラグイン・CSS ファースト設定）を採用し、UI プリミティブは **shadcn/ui** 方式（コンポーネントをリポジトリ内にコピーして所有＝依存ライブラリではない）で構築する。ユーティリティは **clsx ＋ tailwind-merge**（`cn`）、バリアントは **class-variance-authority (cva)**、アクセシブルな土台は **Radix UI**（shadcn が内部利用）、アイコンは **lucide-react**。
- **採用理由**:
  - MVP は素の CSS（`app.css`）だったが、M6 で **2画面構成・ホーム/編集の本格 UI・生成中オーバーレイ・サイドメニュー**を作るため、一貫したデザイントークンとアクセシブルな部品が必要になった。Tailwind＋shadcn/ui は**トークン（CSS 変数）で見た目を一元管理**でき、CODING/PLAN_PHILOSOPHY の「見た目の変動点を局所化」に合う。
  - shadcn/ui は**ライブラリ依存ではなくコード所有**方式。`components/ui/` に置いた部品を自由に改変でき、ロックインが小さい（PLAN_PHILOSOPHY「過剰なロックインの回避」）。Radix ベースでキーボード操作/フォーカス管理などアクセシビリティを最初から確保。
  - Tailwind v4 は `@tailwindcss/vite` で Vite と親和し、`tailwind.config.js` 不要の CSS ファースト。既存の `manualChunks`（NFR-2）方針と両立する。
- **類似技術との比較**:
  - **MUI / Chakra / Ant Design**: 完成度は高いが、ランタイム依存が重くデザインのロックインが強い。React Flow ノード等の細かな自作 UI と混ぜると重複・肥大しやすい。shadcn/ui のコード所有＋Tailwind の方が軽量で自由度が高く不採用。
  - **素の CSS / CSS Modules 継続**: 画面数が増える M6 では、トークン共有・状態バリアント・a11y を毎回手書きするコストが高い。段階移行の起点として Tailwind＋shadcn を採用。
  - **Tailwind v3（PostCSS 設定）**: 動作するが、Vite では v4＋`@tailwindcss/vite` の方が設定が簡潔で最新。v4 を採用。
- **配置**: プリミティブは `apps/web/src/components/ui/`、`cn` 等は `apps/web/src/lib/`、トークン/テーマは `apps/web/src/index.css`（`@theme`／CSS 変数）。詳細は DIRECTORY_STRUCTURE を参照。
- **出典**: https://ui.shadcn.com/docs / https://tailwindcss.com/docs/installation/using-vite / https://tailwindcss.com/blog/tailwindcss-v4

### 2.6 LLM 連携: Anthropic Claude（Haiku 4.5）＋ 構造化出力 ＋ 抽象層

- **選定**:
  - SDK: **@anthropic-ai/sdk**（TypeScript、最新安定。2026-06 時点で 0.105 系が公開、Opus 4.x / Sonnet 4.x / Haiku 4.5 対応）。**サーバー側のみ**で使用。
  - モデル: **Claude Haiku 4.5**（`claude-haiku-4-5`）を既定。短い日本語連想語生成にコスト/速度が最適。品質が要れば Sonnet へ切替可能にする。
  - 出力: **Structured Outputs（JSON Schema, constrained decoding）** を用い、連想語配列を機構的にスキーマ準拠で取得（FR-5 の整形を安定化）。
  - 抽象層: **`AssociationProvider`** インターフェース（`associate(input: string, count: number): Promise<AssociationWord[]>`）を定義し、その実装として `ClaudeAssociationProvider` を置く。アプリ本体・オーケストレーションはこのインターフェースにのみ依存する。
- **選定理由**:
  - 確定制約③（Claude）かつ本環境が Claude で、構造化出力が GA・実装容易。FEASIBILITY で第一候補。
  - 構造化出力で「形式」を保証し、アプリ側で**件数=配列長チェック・重複/空/無関係の後処理**（Structured Outputs は配列長の数値制約は非対応のため）を担保（FR-4,5 / AC-2）。これは Zod でも二重に検証（2.7）。
  - PLAN_PHILOSOPHY の最重要拡張点。**OpenAI / Gemini への差し替えを `AssociationProvider` の別実装追加だけで可能**にし、ドメイン・UI に波及させない。FEASIBILITY のコスト表（Haiku 入力$1/出力$5 per 1M に対し、GPT-4o-mini / Gemini Flash-Lite はさらに安価）を踏まえ、PoC 後にコスト最適化でプロバイダ切替できる余地を残す。
- **類似技術との比較**:
  - **OpenAI GPT-4o-mini / GPT-4.1-mini**: strict structured outputs が堅牢で最安級。コスト最優先なら有力だが、確定制約③で第一は Claude。抽象層の差し替え候補として保持。
  - **Google Gemini 2.5 Flash-Lite/Flash**: 最安・JSON Schema 対応。同上、差し替え候補。
  - **Vercel AI SDK 等のマルチプロバイダ抽象**: 既製の抽象は便利だが、本件は連想生成という**狭く明確な1インターフェース**しか要らず、自前の薄い `AssociationProvider` の方が依存を減らし制御しやすい（過剰設計回避＋内向き依存）。MVP では自前抽象を採用、将来必要なら AI SDK 導入も可。
- **出典**: https://platform.claude.com/docs/en/build-with-claude/structured-outputs / https://platform.claude.com/docs/en/about-claude/pricing / https://www.anthropic.com/news/claude-haiku-4-5 / https://www.npmjs.com/package/@anthropic-ai/sdk

### 2.7 バリデーション: Zod

- **選定**: **Zod**（最新安定 v3/v4 系）。フロント・API サーバー双方で使用。
  - LLM 応答の検証（構造化出力の二重チェック・件数/重複/空の後処理の起点）。
  - API リクエスト/レスポンスの検証（`@hono/zod-validator`）。
  - フォーム入力（キーワード・生成件数レンジ）の検証。
- **選定理由**: CODING_PHILOSOPHY「外部入出力はスキーマ検証してから型付き値として扱う」を直接実現。Zod は**スキーマから TS 型を導出**でき（`z.infer`）、型とランタイム検証を単一定義で一致させられる。Hono・React・Anthropic 応答すべてに同じ語彙で適用できる。
- **類似技術との比較**:
  - **Valibot**: 軽量・モジュラーで bundle に優れるが、エコシステム連携（Hono バリデータ・各種例）の厚みで Zod が優位。差別化が決定的でなく不採用。
  - **Yup / io-ts / TypeBox**: Yup は型導出が弱い、io-ts は学習コスト高、TypeBox は JSON Schema 寄り。総合的に Zod が TS 親和・情報量で最良。
- **出典**: https://zod.dev / https://github.com/honojs/middleware/tree/main/packages/zod-validator

### 2.8 認証: Supabase Auth（Google OAuth）＋ サーバー側 JWT 検証

- **選定**: **Supabase Auth** の **Google OAuth** プロバイダ。
  - フロント: `@supabase/supabase-js` でログイン（OAuth リダイレクト）し、アクセストークン（JWT）を取得・保持。**ゲストはログインせず利用**でき、**保存操作時のみログインを要求**（FR-18,19 / AC-8,9）。
  - API サーバー: 受け取った JWT を **Supabase の JWKS エンドポイント（ES256・非対称署名鍵）で検証**し、`sub`（user_id）を取得。**保存系エンドポイントは検証必須、生成系は任意（未認証でも生成可）**。
- **選定理由**:
  - 確定制約②（Supabase）と DB を一本化でき、`auth.uid()` を使った RLS（2.9）と直結する。OAuth プロバイダ設定が管理コンソールで完結し、Google OAuth（FR-20）を最小実装で導入できる。
  - 「ゲスト利用可・保存時のみ認証必須」を、**操作単位の認可**で自然に表現できる（生成 API は匿名許可、保存 API は要トークン）。FEASIBILITY 検証ポイント4の構成を Supabase で具体化。
  - **別 API サーバーでの検証**は、Supabase が公開する **JWKS（非対称鍵 ES256）** を使い、サーバー起動時に公開鍵を取得・キャッシュして各リクエストでローカル検証する標準パターンが確立している（鍵ローテーション/失効に強く、シークレット共有不要）。
- **類似技術との比較**:
  - **Auth.js (NextAuth)**（FEASIBILITY の旧候補）: Next.js 前提色が強く、フロント/API 分離・SPA・別サーバー検証構成では噛み合わせが悪い。かつ Supabase と二重に認証基盤を持つことになり、RLS（auth.uid()）連携の利点を失う。確定制約②に反するため不採用。
  - **Clerk / Auth0**: 機能豊富だが追加サービス・コスト・ロックインが増え、Supabase に認証があるのに別基盤を足す合理性がない。不採用。
  - **API サーバーで JWT を JWKS 検証せず Supabase に都度問い合わせる案**: ネットワーク往復が増え遅く脆い。JWKS ローカル検証が標準で速い。不採用。
- **トークン引き継ぎ（留意）**: 「ゲストで作ったマップをログイン後に保存」は、フロント保持中のマップをログイン直後に保存 API へ送る独自実装で対応（FEASIBILITY 申し送り）。MVP は「ログインしてその場のマップを保存」で AC を満たす。
- **出典**: https://supabase.com/docs/guides/auth/signing-keys / https://supabase.com/docs/guides/auth/jwts / https://supabase.com/blog/jwt-signing-keys / https://supabase.com/docs/guides/auth/server-side/creating-a-client

### 2.9 DB / 永続化: Supabase（PostgreSQL）＋ RLS

- **選定**: **Supabase（PostgreSQL）**。本人限定アクセスは **Row Level Security (RLS)** ＋ `auth.uid()` ポリシーで **DB 層強制**。
  - **サーバーからのアクセス方法**: 保存系は **ユーザーの JWT を引き継いだ Supabase クライアント**（`@supabase/supabase-js` に Authorization ヘッダを付与）で発行し、**RLS を効かせて本人の行のみ**操作する。`service_role`（RLS バイパス）は**管理目的に限定**して使う（漏洩時に全行アクセス可となるため濫用しない）。
  - **マイグレーション**: **Supabase CLI のマイグレーション**（SQL マイグレーションファイルをバージョン管理）を採用。スキーマ・RLS ポリシーをコード化し再現可能にする。
- **選定理由**:
  - 確定制約②。FR-22 / NFR-6 / AC-11「本人のみアクセス」を**アプリ層の user_id チェックに頼らず DB 層で強制**でき、認可漏れの事故耐性が高い（CODING_PHILOSOPHY「認可はサーバー側で必ず担保」をさらに DB で二重化）。
  - 永続化は `StorageRepository` 的なインターフェース背後に置き、ストレージ実装変更がドメインに波及しないようにする（PLAN_PHILOSOPHY 変動点の抽象化）。
  - マップ/ノード/エッジを正規化保存するか JSON 1カラムにするかは **docs/DATABASE.md** で確定（FEASIBILITY 申し送り）。
- **類似技術との比較**:
  - **アプリ層のみで user_id チェック（RLS なし）**: 実装は軽いが、認可漏れが即データ漏洩になる。RLS で DB 層に最後の砦を置く方が思想（型/エラー/認可を堅く）に合致。RLS を採用。
  - **Prisma を ORM として被せる**: 型安全な DB アクセスは魅力だが、RLS（auth.uid() 依存）との両立に追加設定が要り、Supabase クライアントで素直に RLS を効かせる方が MVP では単純。Prisma は将来の選択肢として保持し、MVP では `supabase-js` を採用。
  - **自前 PostgreSQL（Neon/RDS 等）＋ 自前認証**: 認証・RLS・コンソールを自前構築する手間が増える。Supabase 一本化の利点（認証×DB×RLS 統合）を捨てる理由がなく不採用（かつ確定制約②）。
- **出典**: https://supabase.com/docs/guides/database/postgres/row-level-security / https://www.postgresql.org/docs/current/ddl-rowsecurity.html / https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa

### 2.10 LLM オーケストレーション（自走展開・停止・レート制御）の方式

確定制約・思想に基づく**実装方式の選定**（ライブラリではなくアーキ方針）。API サーバー（Hono/Node）内のドメインサービスとして実装する。

- **自走展開**: **BFS（幅優先・キュー方式）** で「展開対象ノード」を処理。各展開で `AssociationProvider.associate()` を呼ぶ。
- **停止条件（FR-13 / AC-3）**: **最大深さ** と **総ノード数上限** をオーケストレータが保持し、キュー投入前に判定して**確実に停止**。境界値（上限ちょうど）を TEST_PHILOSOPHY の最重点としてユニットテスト。
- **一時停止/停止（FR-14 / AC-6）**: 展開ジョブに**停止フラグ/トークン**を持たせ、各ステップで確認。
- **多重実行抑制・レート制御（NFR-4）**: 同一マップ/同一ノードの**同時展開をロック**（処理中フラグ）し、プロバイダ 429 対策に**並列度の制限と指数バックオフ**を入れる。レート制御はサーバー側に集約（API キーと同じくサーバー責務）。
- **選定理由**: PLAN_PHILOSOPHY「コスト/暴走をアーキテクチャで制御」「停止条件は生成オーケストレーション層の責務」を直接実装。停止ロジックは**純粋関数寄りに切り出し**、LLM をモックしてテスト可能にする（TEST_PHILOSOPHY）。
- **比較・不採用**: 外部ジョブキュー（BullMQ/Redis 等）は MVP のコール数（FEASIBILITY 概算で1マップ10コール以下）に対し過剰。インメモリのキュー＋ロックで足り、過剰設計を避ける。将来スケール時に外部キューへ差し替える余地は残す。
- **出典**（コスト/暴走の前提）: docs/FEASIBILITY.md 検証ポイント3 / https://platform.claude.com/docs/en/about-claude/pricing

### 2.11 テスト: Vitest（ユニット主軸）＋ Testing Library ＋ 最小 E2E（Playwright）

- **選定**:
  - **テストランナー: Vitest**（最新安定 v3 系）。フロント・API サーバー双方のユニット/統合テスト。
  - **コンポーネント: @testing-library/react ＋ @testing-library/jest-dom**（Vitest と互換）。
  - **E2E（最小限）: Playwright**。主要ハッピーパス1〜2本のみ。
- **選定理由**:
  - **Vitest**: Vite と設定を共有でき（2.2）、TS/ESM ネイティブで `esbuild` 変換が速い。watch 再実行が高速で、TEST_PHILOSOPHY の「重要部分を素早く回す」開発体験に最適。LLM/認証/DB は**モック**してコアロジック（連想パース・件数反映・停止条件・モード分岐・編集・認可）を決定的にテスト（TEST_PHILOSOPHY 重点1〜5）。
  - **Playwright**: E2E は最小限の方針に対し、安定性・デバッグ性が高く 1〜2 本の運用に十分。
- **類似技術との比較**:
  - **Jest**: 実績豊富だが TS/ESM に ts-jest/Babel 変換が要り遅い。Vite プロジェクトでは設定二重化になる。新規 Vite プロジェクトで Vitest を選ぶ合理性が高く不採用（React Native 等でないため Jest の利点が効かない）。
  - **Cypress（E2E）**: 良いが Playwright の方が並列/マルチブラウザ/速度で優位、最小 E2E 用途では Playwright を採る。
- **出典**: https://www.sitepoint.com/vitest-vs-jest-2026-migration-benchmark/ / https://www.pkgpulse.com/blog/vitest-3-vs-jest-30-2026

### 2.12 リンタ / フォーマッタ: ESLint ＋ Prettier

- **選定**: **ESLint**（typescript-eslint、Flat Config）＋ **Prettier**。CODING_PHILOSOPHY で指定。
- **選定理由**: 型厳格方針を ESLint ルール（`no-explicit-any` 等）で補強し、整形は Prettier に一任（手動整形しない方針）。情報量・エコシステムが最大で、CI（2.13）に組み込みやすい。
- **類似技術との比較**:
  - **Biome**（lint＋format 一体・高速）: 魅力的で将来有力だが、typescript-eslint の型情報ルールや既存プラグイン資産の厚みで現状 ESLint が優位。CODING_PHILOSOPHY も ESLint+Prettier を例示。MVP は確実な ESLint+Prettier を採用、Biome は将来見直し候補。
- **出典**: https://typescript-eslint.io / https://prettier.io

### 2.13 CI: GitHub Actions

- **選定**: **GitHub Actions**。PR で **型チェック（tsc --noEmit）／ ESLint ／ Vitest（重点テスト）** を実行し、グリーン必須のゲートにする。
- **選定理由**: TEST_PHILOSOPHY「重点テストとリンタ/型チェックを CI で実行しグリーン維持」、GIT_CONVENTIONS（PR 運用）と整合。GitHub リポジトリ前提で追加コストゼロ、無料枠で個人開発に十分。
- **類似技術との比較**: GitLab CI / CircleCI も可だが、GitHub 利用前提では Actions が最も摩擦が小さい。不採用に積極理由はなく、リポジトリと同居する Actions を採用。

### 2.14 ホスティング / デプロイ

フロントと API サーバーを**それぞれ別に**デプロイする（構成分離）。個人開発・無料枠を重視。

#### フロント（React SPA 静的配信）
- **選定**: **Cloudflare Pages** または **Vercel**（いずれも静的 SPA を無料枠で配信可、第一候補は実装時の好みで確定）。
- **選定理由**: SPA の静的ホスティングは両者とも無料枠が潤沢・CDN・自動デプロイ完備。Vite ビルド成果物をそのまま配信できる。
- **比較**: GitHub Pages も可だが、独自ドメイン・プレビュー・環境変数管理で Pages/Vercel が便利。大差なし。

#### API サーバー（Hono on Node.js）
- **選定**: **Render（無料 Web Service）** を第一候補、**Fly.io** を次点。
- **選定理由**:
  - 自走展開は**複数 LLM 呼び出し・やや長め・状態を持つ処理**で、**Node ランタイムの通常サーバー**が素直（2.4 のランタイム判断）。Render の無料枠は Node をそのまま動かせ、CLI 不要で素早い。
  - **Cloudflare Workers を API に使わない理由**: Workers は **CPU 10ms 制限・Node API 非互換**で、自走展開のオーケストレーションに不向き（複数の外部 API 待ち・状態管理が窮屈）。Hono を選んでいるので**将来 Edge へ寄せる移植余地は残る**が、MVP は通常 Node サーバーで実装する。
  - **Render 無料枠の制約（コールドスタート）**: 無アクティビティで spin-down し復帰に約1分。個人開発 MVP では許容範囲。常時起動が要れば Fly.io / 有料枠に移行（Hono なので移植容易）。
- **類似技術との比較**:
  - **Cloudflare Workers**: 上記理由で API 本体には不採用（コールドスタートは無いが実行制約が痛い）。静的フロント配信や軽量補助には有用。
  - **Fly.io**: 常時起動・コンテナで柔軟。無料/低額枠あり。Render より設定の自由度が高い分やや手間。次点。
  - **Vercel Functions / AWS Lambda**: サーバレス関数は実行時間・状態管理の制約や設定コストがあり、自走展開の常駐的処理には Render の通常サーバーが分かりやすい。次点以下。
- **出典**: https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026 / https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/hono/ / https://hono.dev/docs/getting-started/nodejs

---

## 3. 技術スタック一覧表（領域 → 採用技術 → バージョン目安）

| 領域 | 採用技術 | バージョン目安（2026-06 時点） | 主な代替（不採用） |
|---|---|---|---|
| 言語（共通） | TypeScript（strict） | 5.x | （確定制約） |
| フロント ビルド | Vite ＋ @vitejs/plugin-react | Vite 7〜8 / plugin v5〜6 | Next.js, CRA, Rsbuild |
| UI | React | 18+ | （React Flow 前提で必然） |
| ルーティング | React Router | 6+ | TanStack Router, Next ルーティング |
| クライアント状態 | Zustand | 5.x | Redux Toolkit, Jotai, Context |
| サーバー状態（任意） | TanStack Query | 5.x | 手書き fetch ラッパ |
| マップ描画 | @xyflow/react（React Flow） | 12.x | Cytoscape.js, vis-network, D3 |
| 自動レイアウト | Dagre（@dagrejs/dagre）／ ELK 差替可 | dagre 1.x / elkjs 0.9.x | d3-hierarchy |
| API サーバー FW | Hono（on Node.js / @hono/node-server） | Hono 4.x | Fastify, Express, NestJS |
| LLM SDK | @anthropic-ai/sdk（サーバー側のみ） | 0.10x 系 | OpenAI/Gemini（抽象層で差替候補） |
| LLM モデル | Claude Haiku 4.5（既定）/ Sonnet 切替可 | claude-haiku-4-5 | GPT-4o-mini, Gemini Flash-Lite |
| LLM 出力 | Structured Outputs（JSON Schema） | GA | tool use, 素のJSON |
| バリデーション | Zod（＋ @hono/zod-validator） | 3〜4 系 | Valibot, Yup, io-ts, TypeBox |
| 認証 | Supabase Auth（Google OAuth）＋ JWKS(ES256) 検証 | supabase-js 2.x | Auth.js, Clerk, Auth0 |
| DB / 永続化 | Supabase（PostgreSQL）＋ RLS / auth.uid() | PostgreSQL 15+ | アプリ層のみ認可, Prisma, 自前PG |
| サーバーからのDBアクセス | JWT 引継ぎ supabase-js（RLS有効）＋ service_role は管理限定 | supabase-js 2.x | 直接接続, service_role 常用 |
| マイグレーション | Supabase CLI マイグレーション | 最新 | 手動SQL, Prisma Migrate |
| テストランナー | Vitest（＋ Testing Library / jest-dom） | Vitest 3.x | Jest |
| E2E（最小） | Playwright | 最新 | Cypress |
| Lint / Format | ESLint（typescript-eslint, Flat Config）＋ Prettier | ESLint 9.x | Biome |
| CI | GitHub Actions | - | GitLab CI, CircleCI |
| フロント配信 | Cloudflare Pages / Vercel（無料枠） | - | GitHub Pages |
| API ホスティング | Render（無料 Web Service）／ Fly.io 次点 | - | Cloudflare Workers, Lambda |

> バージョンは実装着手時の最新安定を採用し、リリースノートで既知問題・破壊的変更を確認すること（特に Vite 8 / Rolldown、Zod 4、ESLint Flat Config）。

---

## 4. 思想・受け入れ条件への適合（トレーサビリティ）

### 4.1 PLAN_PHILOSOPHY（拡張性・変動点の抽象化）
- **LLM プロバイダ抽象**: `AssociationProvider`（入力語→連想語リスト）で Claude を隠蔽、OpenAI/Gemini へ差替可（2.6）。
- **永続化抽象**: `StorageRepository` 的境界で Supabase を隠蔽（2.9）。
- **レイアウト抽象**: `layout()` 関数境界で Dagre↔ELK 差替可（2.5）。
- **境界の明確化**: 生成（API サーバー）／状態・描画（Zustand＋React Flow）／永続化（Supabase）／認証（Supabase Auth）を疎結合に分離（1章）。
- **依存方向は内向き**: ドメイン（連想・マップ・停止条件）を Hono/React/Supabase に依存させない構成（2.4, 2.10）。
- **過剰設計の回避**: 外部ジョブキュー・マルチプロバイダ既製抽象・重量 FW（NestJS/Redux）を MVP では見送り（2.4,2.6,2.10,2.3）。

### 4.2 CODING_PHILOSOPHY（型厳格・エラー明示・シークレット）
- TS strict ＋ Zod でフロント/サーバー I/O・LLM 応答をスキーマ検証（2.1,2.7）。
- API キーはサーバー環境変数のみ（@anthropic-ai/sdk をサーバー側だけで使用、AC-13）。
- 認可は API サーバー（JWT 検証）＋ DB（RLS）で二重に担保（2.8,2.9 / AC-11）。
- エラー再試行 UI は TanStack Query / Zod エラーの日本語表示で実装（FR-6/AC-12）。

### 4.3 TEST_PHILOSOPHY（重要部分を絞る）
- Vitest ユニット主軸、LLM/認証/DB をモック（2.11）。
- 重点: 連想パース・件数反映（AC-2）、停止条件の境界値（AC-3,6）、自動/手動分岐（AC-4,5）、ノード編集とエッジ整合（AC-7）、認可（AC-8〜11）。
- E2E は Playwright で主要ハッピーパス1〜2本のみ。
- CI（GitHub Actions）で型チェック＋ESLint＋重点テストをゲート化。

### 4.4 受け入れ条件（AC）と担保技術の対応
| AC | 担保する技術/方式 |
|---|---|
| AC-1,2 | Anthropic 構造化出力＋Zod 件数/重複検証（2.6,2.7） |
| AC-3,6 | オーケストレータの停止条件・停止フラグ（2.10） |
| AC-4,5 | 自動/手動モードを Zustand 状態＋オーケストレータ分岐（2.3,2.10） |
| AC-7 | Zustand ストアのノード/エッジ整合ロジック＋React Flow 描画（2.3,2.5） |
| AC-8,9 | Supabase Auth：生成は匿名可・保存は要トークン（2.8） |
| AC-10,11 | Supabase RLS（auth.uid()）＋ JWT 引継ぎアクセス（2.8,2.9） |
| AC-12 | エラー型＋日本語表示＋再試行 UI（2.7,2.11） |
| AC-13 | LLM 呼び出しを Hono/Node サーバーに隔離、キーはサーバーのみ（1,2.4,2.6） |

---

## 5. リスク・ロックイン・整合性チェック

- **スタック整合性**: TypeScript で統一。Vite↔Vitest、Hono↔Zod、Supabase(Auth↔DB↔RLS) がそれぞれ密に噛み合い、設定重複が少ない。React Flow↔Zustand 連携も公式想定。
- **ロックイン**:
  - Supabase（確定）: Auth/DB/RLS 一体で利点大だが移行は重い。永続化抽象（`StorageRepository`）と標準 PostgreSQL/RLS 準拠で緩和。
  - Claude（確定）: `AssociationProvider` 抽象で他プロバイダ差替可にしロックインを限定。
  - Hono: マルチランタイム対応で、むしろインフラ・ロックインを下げる方向。
- **コスト**: 自走展開は停止条件でコスト上限を担保（NFR-3）。Haiku 4.5 既定で安価、必要に応じ更に安価なプロバイダへ差替余地（2.6）。ホスティングは全領域で無料枠から開始可能。
- **既知の注意点**:
  - Vite 8 / Rolldown は大型変更。プラグイン互換に不安あれば v7 開始→追従（2.2）。
  - Dagre はメンテ非活発 → ELK 差替路を確保（2.5）。
  - Render 無料枠はコールドスタート約1分 → 許容できなければ Fly.io / 有料（2.14）。
  - Structured Outputs は配列長の数値制約非対応 → 件数は Zod＋後処理で担保（2.6,2.7）。
  - service_role はRLSバイパス → 管理限定で濫用しない（2.9）。

---

## 6. 設計フェーズ（次ステップ）への申し送り

- **docs/DESIGN.md**:
  - レイヤ構成（ドメイン / オーケストレーション / API / UI）と依存方向（内向き）の図示。
  - `AssociationProvider` / `StorageRepository` / `layout()` のインターフェース定義。
  - 自走展開 BFS・停止条件・多重実行抑制・バックオフの具体設計（FR-13,14 既定値の確定：例 最大深さ3・総ノード上限50・件数初期6/範囲3〜10 を最終決定）。
  - 認証フロー詳細（OAuth リダイレクト、JWKS 取得/キャッシュ、生成=匿名可・保存=要トークンの境界）。
  - エラー型と日本語メッセージ方針、再試行 UX。
- **docs/DATABASE.md**:
  - ユーザー/マップ/ノード/エッジのデータモデル（正規化 vs JSON 1カラムの確定）。
  - RLS ポリシー（auth.uid() による本人限定）と Supabase CLI マイグレーション方針。
- **PoC（FEASIBILITY 申し送り、技術選定と並行）**:
  - Claude Haiku 4.5 ×代表キーワードで、日本語連想品質・件数追従・重複/無関係率・p50/p95 レイテンシを実測。
  - 深さ3・上限50 で自走展開を実走し、総コール数・合計コスト・429 発生を計測（多重実行抑制とバックオフ試作）。
  - 結果次第で、より安価なプロバイダ（GPT-4o-mini / Gemini Flash-Lite）への差替を `AssociationProvider` 経由で検討。
- **未確定（設計で決める）**: フロント配信先（Cloudflare Pages or Vercel）、API ホスティング確定（Render or Fly.io）、Vite メジャー（7 or 8）、TanStack Query 採否、Zod メジャー、ESLint/Biome の最終判断。

---

## 付録: 主要出典一覧

- Vite 7: https://vite.dev/blog/announcing-vite7
- Vite 8 / Rolldown: https://vite.dev/blog/announcing-vite8
- vite-plugin-react: https://github.com/vitejs/vite-plugin-react/releases
- 状態管理比較(2026): https://dev.to/jsgurujobs/state-management-in-2026-zustand-vs-jotai-vs-redux-toolkit-vs-signals-2gge / https://zustand.docs.pmnd.rs/learn/getting-started/comparison
- API FW 比較(2026): https://www.oflight.co.jp/en/columns/hono-vs-express-fastify-elysia-comparison-2026 / https://encore.dev/articles/nestjs-vs-fastify-vs-hono
- Hono on Node.js: https://hono.dev/docs/getting-started/nodejs
- Hono zod-validator: https://github.com/honojs/middleware/tree/main/packages/zod-validator
- React Flow Layouting: https://reactflow.dev/learn/layouting/layouting / https://reactflow.dev/examples/layout/dagre / https://reactflow.dev/examples/layout/elkjs / https://reactflow.dev/examples/layout/expand-collapse
- Claude 構造化出力: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Claude 料金: https://platform.claude.com/docs/en/about-claude/pricing
- Claude Haiku 4.5: https://www.anthropic.com/news/claude-haiku-4-5
- Anthropic TS SDK: https://www.npmjs.com/package/@anthropic-ai/sdk
- Zod: https://zod.dev
- Supabase JWT 署名鍵/JWKS: https://supabase.com/docs/guides/auth/signing-keys / https://supabase.com/docs/guides/auth/jwts / https://supabase.com/blog/jwt-signing-keys
- Supabase サーバークライアント: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- service_role 注意: https://supabase.com/docs/guides/troubleshooting/performing-administration-tasks-on-the-server-side-with-the-servicerole-secret-BYM4Fa
- Vitest vs Jest(2026): https://www.sitepoint.com/vitest-vs-jest-2026-migration-benchmark/ / https://www.pkgpulse.com/blog/vitest-3-vs-jest-30-2026
- 無料枠ホスティング(2026): https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026
- Hono on Cloudflare Workers: https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/hono/
