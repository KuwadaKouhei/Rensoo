# Rensoo 実現可能性調査 (FEASIBILITY)

- ステータス: ドラフト（STEP1.5 実現可能性調査 / 全6フェーズ）
- 最終更新: 2026-06-26
- 対象要件: docs/REQUIREMENTS.md
- 次フェーズ: STEP2 技術選定（docs/TECH_STACK.md）／困難判定があれば STEP1（/1-requirements）へ差し戻し

---

## 0. 概要・総合判定

要件定義書（docs/REQUIREMENTS.md）の主要要件について、社内資産（本プロジェクトは未実装でコードなし。要件のみ存在）と外部一次情報（各 LLM プロバイダ公式ドキュメント・料金、React Flow 公式、Auth.js 公式、PostgreSQL/Supabase RLS）を裏取りして検証した。

総合判定: 実現可能（技術的なブロッカーなし）。主要要件はいずれも成熟した既存技術・サービスで実装でき、「困難・要再検討」に分類される要件はない。ただし以下 2 点は PoC（スパイク）で早期に裏付けることを強く推奨する。

1. LLM 連想語の出力品質と安定性（FR-2〜FR-5） … 構造化出力で「形式」は保証できるが、「日本語連想語としての質・重複/無関係除去」はプロンプト次第。実データでの確認が必要。
2. 自走展開のコスト・暴走制御（FR-10〜FR-14 / NFR-3,4） … 機構自体は実装可能。実際のコスト感とレート制御の挙動を小規模 PoC で測定すべき。

いずれも「実現できるか」ではなく「品質・コストをどこに落ち着けるか」の問題であり、要件差し戻しは不要。

---

## 1. 検証ポイント一覧と判定サマリ

| # | 検証ポイント | 対応要件 | 判定 |
|---|---|---|---|
| 1 | LLM連想語生成（構造化・日本語・件数可変・レイテンシ・コスト） | FR-1〜6, NFR-1 | 条件付き可能（PoC推奨） |
| 2 | マインドマップ描画（ノード/エッジ・ズーム/パン・クリック展開・自動レイアウト） | FR-7〜9, NFR-2 | 実現可能 |
| 3 | 自走展開のコスト/暴走制御（深さ・ノード上限・多重実行抑制・レート制御） | FR-10〜14, NFR-3,4 | 条件付き可能（PoC推奨） |
| 4 | 認証(OAuth)＋ゲスト利用の両立 | FR-18〜20 | 実現可能 |
| 5 | 永続化(DB)・本人のみアクセス | FR-21,22, NFR-6 | 実現可能 |

判定区分: 実現可能 / 条件付き可能（実装可能だが品質・コスト等を PoC や設計で詰める前提）/ 困難・要再検討

---

## 2. 各要件の判定と根拠（出典付き）

### 検証ポイント1: LLM連想語生成 — 判定: 条件付き可能（PoC推奨）

問い: 「キーワードから連想される日本語語を N 個」を構造化（JSON配列等）で安定取得できるか。形式安定化手法・日本語品質・レイテンシ・概算コストは。

根拠（形式の安定性）: 主要 3 プロバイダすべてが JSON Schema 準拠を保証する「構造化出力（Structured Outputs）」を提供しており、出力フォーマット（連想語の配列）は機構的に保証できる。

- Anthropic Claude: Structured Outputs が GA。output_config.format（type は json_schema）で constrained decoding により JSON Schema 準拠を保証（JSON.parse エラーなし／必須フィールド保証）。対応モデルに Opus 4.8 / Sonnet 4.6 / Haiku 4.5 等。配列・enum・anyOf 等の標準スキーマに対応（再帰スキーマ・数値/文字列長制約は非対応のため、件数イコール配列長の制約はアプリ側で担保）。初回はグラマーコンパイルで追加レイテンシ、以降 24h キャッシュで高速化。出典: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- OpenAI: Structured Outputs（strict mode）で JSON Schema 準拠を保証。GPT-4o 以降が対応。出典: https://developers.openai.com/api/docs/guides/structured-outputs
- Google Gemini: responseMimeType を application/json にし responseSchema（JSON Schema）で配列（type array, items は string）を要求可能。構文的に正しい JSON でスキーマ準拠を保証。出典: https://ai.google.dev/gemini-api/docs/structured-output ／ https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-structured-outputs/

根拠（信頼性）: 第三者ベンチで Claude Sonnet 4.6 の tool use / 構造化出力は 30 万コールで失敗率 0.2% 未満（OpenAI Structured Outputs に次ぐ信頼性）と報告。形式逸脱のリスクは実務上きわめて低い。出典: https://tokenmix.ai/blog/structured-output-json-guide

概算コスト（2026/06 公式料金、100万トークンあたり 入力/出力 USD）:

| プロバイダ/モデル | 入力 | 出力 |
|---|---|---|
| Claude Haiku 4.5 | 1.00 | 5.00 |
| Claude Sonnet 4.6 | 3.00 | 15.00 |
| OpenAI GPT-4o-mini | 0.15 | 0.60 |
| OpenAI GPT-4.1-mini | 0.40 | 1.60 |
| Gemini 2.5 Flash-Lite | 0.10 | 0.40 |
| Gemini 2.5 Flash | 0.30 | 2.50 |

連想語生成1回はプロンプトと出力で概ね数百〜千トークン程度（連想語6件・短い文字列）。低価格帯モデル（GPT-4o-mini / Gemini Flash-Lite / Claude Haiku）なら 1回あたり概ね 0.0005〜0.005 USD 程度に収まる見込み。出典: https://platform.claude.com/docs/en/about-claude/pricing ／ https://openai.com/api/pricing/ ／ https://www.metacto.com/blogs/the-true-cost-of-google-gemini-a-guide-to-api-pricing-and-integration

不確実性（→PoC対象）: (a) 日本語連想語としての質（無関係・重複・固有名詞偏り）、(b) 重複/空/無関係除去（FR-5）の効きやすさ、(c) 実レイテンシが NFR-1「数秒以内」に収まるか。これらは公式仕様では裏取りできず、実プロンプト×実モデルでの計測が必要。本環境のアシスタントは Claude のため Claude 第一候補は妥当だが、コスト最優先なら Gemini Flash-Lite / GPT-4o-mini も比較候補。

### 検証ポイント2: マインドマップ描画 — 判定: 実現可能

問い: ノードとエッジの自動レイアウト・ズーム/パン・ノードクリック展開ができる React 向けライブラリは実在し適切か。

根拠: React Flow（@xyflow/react）が要件を直接満たす。

- 自動レイアウト: Dagre（ドロップイン）/ ElkJS / D3-Hierarchy を公式に統合。useAutoLayout フック例あり（FR-9 自動配置）。出典: https://reactflow.dev/examples/layout/auto-layout ／ https://reactflow.dev/examples/layout/dagre ／ https://reactflow.dev/examples/layout/elkjs ／ https://reactflow.dev/learn/layouting/layouting
- クリックで展開/折りたたみ: useExpandCollapse の公式例があり、クリックで子ノードを展開（FR-11 手動展開／FR-7 ノードとエッジ）。出典: https://reactflow.dev/examples/layout/expand-collapse
- ズーム/パン（FR-8）はライブラリ標準機能。動的レイアウト例も提供。出典: https://reactflow.dev/examples/layout/dynamic-layouting

数十ノード規模（NFR-2）は React Flow の想定範囲内。代替候補は Cytoscape.js（グラフ理論寄り）／vis-network／D3 直書きだが、React 前提・ノードを React コンポーネントで自由実装できる点で第一候補は React Flow。

### 検証ポイント3: 自走展開のコスト/暴走制御 — 判定: 条件付き可能（PoC推奨）

問い: 自動連鎖で再帰的に LLM を呼ぶ際の深さ・総ノード上限・多重実行抑制・レート制御の実装可否と、コスト上限見積り。

根拠（実装可否）: 停止条件（最大深さ・総ノード上限）は BFS/キュー方式の純粋なアプリロジックで実装可能（FR-13）。多重実行抑制・一時停止/停止（FR-14, NFR-4）はサーバー側のジョブ管理とクライアント側状態で実現でき、特別な技術障壁はない。LLM 呼び出しはサーバー側に集約し API キーを秘匿（NFR-5, AC-13）すれば、そこにレート制御・上限チェックを集約できる。

コスト上限の見積り（例: 1ノード6件・最大深さ3・総ノード上限50）:

- API コール数 は「展開を行ったノード数」。起点1から6、さらに各6で展開していくが、総ノード上限50で停止するため、展開回数は最大でも 8〜9回程度（起点1回と第1層の数ノード分）に制約される。上限50ノードに達するまでに必要な生成呼び出しはおおむね10回以下。
- 低価格帯モデルで1回が 0.001〜0.005 USD とすると、1マップの自動展開フル実行で概ね 0.01〜0.05 USD 程度。停止条件があるためコストは確実に上限で頭打ち（NFR-3）。

不確実性（→PoC対象）: 実際の1コールあたりトークン量・レイテンシ、同時展開時のレート制限（プロバイダ側 429）への当たりやすさ。小規模 PoC で実測すべき。

### 検証ポイント4: 認証(OAuth)とゲスト利用の両立 — 判定: 実現可能

問い: ゲストで利用開始でき、保存時のみ OAuth ログインを要求する構成は一般的な認証基盤で可能か。

根拠: Auth.js (NextAuth) が OAuth/OIDC（Google 等）を標準サポート。ゲストはログイン無しで利用し、保存操作（FR-19）でログイン要求する形は、認可をアプリ側のルート/操作単位で制御する一般的パターンで実現可能（保存 API のみ認証必須にする）。出典: https://authjs.dev/getting-started/providers/google ／ https://next-auth.js.org/configuration/providers/oauth ／ https://nextjs.org/learn/dashboard-app/adding-authentication

留意点: 「ゲスト利用中に作ったマップをログイン後に引き継ぐ」挙動（ゲストから認証ユーザーへのデータ移行）はフレームワーク標準機能ではなく、コールバック（signIn 等）とクライアント保持のマップをログイン直後に保存 API へ送る独自実装が必要。要件上は「保存はログイン後」であり MVP では「ログインしてその場のマップを保存」で満たせるため障壁にはならないが、UX 詳細は設計で確定。

### 検証ポイント5: 永続化(DB)・本人のみアクセス — 判定: 実現可能

問い: ユーザー・マップ・ノード・エッジを保存し、本人のみアクセスする構成に障害はないか。

根拠: ユーザー/マップ/ノード/エッジのリレーショナル保存は標準的（PostgreSQL 等）。本人のみアクセス（FR-22, NFR-6）は (a) アプリ層で user_id 一致チェック、または (b) PostgreSQL Row Level Security (RLS) でDB層強制が可能。RLS は「ポリシーで各ユーザーが見える行を限定し、アプリからバイパス不可（特権なしでは）」。Supabase なら auth.uid() ヘルパで所有者ポリシーを記述でき、Prisma 連携拡張も存在。出典: https://www.postgresql.org/docs/current/ddl-rowsecurity.html ／ https://supabase.com/docs/guides/database/postgres/row-level-security ／ https://github.com/dthyresson/prisma-extension-supabase-rls

特別な障害はなく実現可能。マップ/ノード/エッジを JSON で1カラム保存するか正規化するかは DB 設計（docs/DATABASE.md）で確定。

---

## 3. リスクと PoC（スパイク）要否

| リスク/不確実性 | 影響要件 | 深刻度 | PoC要否 | 検証方法 |
|---|---|---|---|---|
| LLM 連想語の日本語品質・重複/無関係除去の効き | FR-2〜5, AC-1,2 | 中 | 要 | 代表キーワード10語×複数モデルで生成し、件数追従・重複/無関係率・日本語の自然さを目視評価 |
| 生成レイテンシが NFR-1（数秒以内）を満たすか | NFR-1 | 中 | 要 | 上記 PoC でモデル別 p50/p95 レイテンシを実測（構造化出力の初回グラマーコンパイル分も含め計測） |
| 自走展開の実コスト・レート制限(429)への当たり | NFR-3,4 | 中 | 要 | 深さ3・上限50で実走行し、総コール数・合計コスト・429発生有無を計測。多重実行抑制とバックオフを試作 |
| ゲストからログイン後のマップ引き継ぎ UX | FR-18,19 | 低 | 任意 | 設計で UX を確定。技術的ブロッカーなし |
| 数十ノード超での描画 FPS（NFR-2） | NFR-2 | 低 | 任意 | React Flow に上限近くのノードを流して操作感確認（公式が想定規模） |
| 構造化出力スキーマの「件数イコール配列長」制約 | FR-4 | 低 | 不要 | Claude/OpenAI は配列長の数値制約非対応のため、アプリ側で件数チェックとトリム/再生成で担保 |

結論: PoC は「LLM 出力品質・レイテンシ」と「自走展開のコスト・レート制御」の 2 本に集約できる（1つの小さな検証スクリプトで兼ねられる）。これは技術選定 STEP2 と並行実施を推奨。

---

## 4. 技術選定（STEP2）への申し送り

主要選定軸と推奨候補（最終確定は docs/TECH_STACK.md）:

- LLM プロバイダ/モデル
  - 比較軸: 日本語連想品質 / 構造化出力の信頼性 / レイテンシ / 単価。
  - 候補: Claude Haiku 4.5（本環境が Claude・構造化出力GA・実装容易、第一候補）／ GPT-4o-mini・GPT-4.1-mini（最安級・strict structured outputs）／ Gemini 2.5 Flash-Lite・Flash（最安・JSON Schema 対応）。
  - 推奨: まず Claude（Haiku 系）で実装し、PoC でコスト/品質を見て低価格帯に切替可能な抽象化（プロバイダ差し替え可能なサーバー層）を用意。
- マインドマップ描画: 推奨 React Flow (@xyflow/react) と自動レイアウトに Dagre（簡便）または ElkJS（高機能）。比較軸: React 親和性 / レイアウト品質 / 学習コスト。
- 認証: 推奨 Auth.js (NextAuth) と Google OAuth。保存系 API のみ認証必須。
- 永続化: PostgreSQL（マップ/ノード/エッジ）。本人限定アクセスは RLS（Supabase 採用時は auth.uid()）またはアプリ層 user_id チェック。比較軸: RLS による DB 層強制 と アプリ層強制の運用負荷。
- アーキテクチャ: LLM 呼び出し・API キーは必ずサーバー側（NFR-5, AC-13）。自走展開の停止条件・レート制御・多重実行抑制もサーバー側に集約。

---

## 5. 総合判定（再掲）

- 総合: 実現可能。「困難・要再検討」要件なし。要件差し戻しは不要。
- 「条件付き可能」とした 2 点（LLM 出力品質/レイテンシ、自走展開コスト/レート制御）は技術的ブロッカーではなく品質・コストのチューニング課題であり、小規模 PoC で早期に裏付けることを推奨。
- 次アクション: STEP2 技術選定（docs/TECH_STACK.md）へ進行。並行して上記 PoC を実施。

---

## 付録: 主要出典一覧

- Claude Structured Outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Claude Pricing: https://platform.claude.com/docs/en/about-claude/pricing
- OpenAI Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI Pricing: https://openai.com/api/pricing/
- Gemini Structured Output: https://ai.google.dev/gemini-api/docs/structured-output
- Gemini JSON Schema 対応(公式ブログ): https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-structured-outputs/
- Gemini Pricing(参考): https://www.metacto.com/blogs/the-true-cost-of-google-gemini-a-guide-to-api-pricing-and-integration
- 構造化出力 信頼性ベンチ(第三者): https://tokenmix.ai/blog/structured-output-json-guide
- React Flow Auto Layout: https://reactflow.dev/examples/layout/auto-layout
- React Flow Expand/Collapse: https://reactflow.dev/examples/layout/expand-collapse
- React Flow Layouting Overview: https://reactflow.dev/learn/layouting/layouting
- Auth.js Google: https://authjs.dev/getting-started/providers/google
- NextAuth OAuth: https://next-auth.js.org/configuration/providers/oauth
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
