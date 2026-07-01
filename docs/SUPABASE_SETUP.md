# Supabase セットアップ手順（クラウド版）

Rensoo の**保存・一覧・再編集・削除**と**Google ログイン**を有効化するための手順です。
Supabase を設定しなくても、連想＋自走展開（ゲスト機能）はそのまま動きます（`AC-8`）。

- 対象: [supabase.com](https://supabase.com) のマネージドプロジェクト（Docker 不要）
- 前提コード: 認証は **JWKS(ES256) によるローカル検証**（[apps/api/src/http/middleware/auth.ts](../apps/api/src/http/middleware/auth.ts)）、
  永続化は **RLS で本人限定**（[supabase/migrations/](../supabase/migrations/)）。
- 所要: 15〜25 分。

> ⚠️ **最重要（つまずきポイント）**: 本 API は Supabase の JWT を **非対称鍵(ES256/ECC)** の公開鍵（JWKS）で検証します。
> プロジェクトの JWT 署名鍵が**レガシーの HS256（共有シークレット）のままだと、保存系 API が常に 401 になります**。
> 手順 4 で必ず「非対称鍵（Current key を ECC に）」へ切り替えてください。

---

## 1. プロジェクトを作成する

1. [supabase.com](https://supabase.com) にサインインし、**New project** を作成。
2. 任意の **Name**、強力な **Database Password**（後で使わないが保管）、**Region** は近い場所（例: Northeast Asia (Tokyo)）。
3. 作成完了まで数分待つ。

## 2. URL と anon キーを取得する

**Project Settings → API** を開き、次の2つを控える。

| 項目 | 使う場所 |
| --- | --- |
| **Project URL**（`https://<ref>.supabase.co`） | `SUPABASE_URL` と `VITE_SUPABASE_URL` |
| **anon public** キー | `SUPABASE_ANON_KEY` と `VITE_SUPABASE_ANON_KEY` |

> `service_role` キーは**使いません**（サーバーもユーザーの JWT を引き継いで RLS を効かせる設計）。絶対にコミット・共有しない。

## 3. 環境変数を設定する

サーバーとフロントの両方に、同じ URL / anon キーを入れます（キー名だけ違う）。

**サーバー** — [apps/api/.env.example](../apps/api/.env.example) をコピー済みの `apps/api/.env` に追記:

```dotenv
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_ANON_KEY=<anon public key>
```

**フロント** — [apps/web/.env.example](../apps/web/.env.example) を `apps/web/.env` にコピーして記入:

```bash
cp apps/web/.env.example apps/web/.env
```
```dotenv
VITE_API_BASE_URL=http://localhost:8787
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

> `.env` は両方とも `.gitignore` 済みでコミットされません。anon キーは公開可能な値ですが、`.env` に集約して管理します。

## 4. JWT 署名鍵を非対称(ES256/ECC)にする ★必須

**Project Settings → JWT Keys**（プロジェクトにより **Authentication → JWT Keys**）を開く。

1. 署名アルゴリズムが **ECC (P-256 / ES256)** の鍵になっているか確認する。
2. まだ **HS256（Legacy shared secret）** の場合は、**新しい非対称鍵を生成し「Current key（現行の署名鍵）」に昇格**させる。
3. 公開鍵が JWKS で配布されることを確認する（ブラウザで開ける）:
   `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`
   → `"kty":"EC"`, `"alg":"ES256"` を含む鍵が返れば OK。

> これで API 側の `createJwksVerifier`（issuer=`<URL>/auth/v1`, audience=`authenticated`）がトークンを検証できます。

## 5. マイグレーションを適用する（テーブル＋RLS）

**SQL Editor** で、次の2ファイルを**この順に**貼り付けて実行する（順序が重要: テーブル → RLS）。

1. [supabase/migrations/20260626090000_create_mindmaps.sql](../supabase/migrations/20260626090000_create_mindmaps.sql)
   （`mindmaps` テーブル・インデックス・`updated_at` 自動更新トリガ）
2. [supabase/migrations/20260626090100_mindmaps_rls.sql](../supabase/migrations/20260626090100_mindmaps_rls.sql)
   （RLS 有効化＋本人限定の SELECT/INSERT/UPDATE/DELETE ポリシー）

適用後、**Table Editor** に `mindmaps` が現れ、**Authentication → Policies** に4つのポリシーが表示されれば成功。

> Supabase CLI を使う場合は代わりに `supabase link --project-ref <ref>` → `supabase db push` でも適用できます。

## 6. Google ログイン（OAuth）を設定する

3か所（Google Cloud → Supabase → リダイレクト URL）を順に設定します。

### 6-1. Google Cloud で OAuth クライアントを作る

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成（既存でも可）。
2. **APIs & Services → OAuth consent screen** を構成（External / アプリ名 / サポートメール。テスト中は自分のアカウントを Test users に追加）。
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**。
   - Application type: **Web application**
   - **Authorized redirect URIs** に Supabase のコールバックを追加:
     `https://<ref>.supabase.co/auth/v1/callback`
4. 発行される **Client ID** と **Client Secret** を控える。

### 6-2. Supabase に Google プロバイダを登録

**Authentication → Providers → Google** を開き、

1. **Enable** をオン。
2. 6-1 の **Client ID** / **Client Secret** を貼り付けて保存。

### 6-3. Site URL / Redirect URLs を設定

**Authentication → URL Configuration**:

- **Site URL**: `http://localhost:5173`（開発。本番は本番オリジン）
- **Redirect URLs** に許可 URL を追加: `http://localhost:5173`
  （本番オリジンも運用時に追加。フロントは `redirectTo: window.location.origin` でコールバックします
  — [apps/web/src/auth/supabaseClient.ts](../apps/web/src/auth/supabaseClient.ts)）

## 7. 動作確認

1. 両サーバーを起動:
   ```bash
   pnpm --filter @rensoo/api dev
   pnpm --filter @rensoo/web dev
   ```
2. ブラウザ（`http://localhost:5173`）で **ログイン** → Google 認証 → 戻ってくる。
3. マップを作成し **保存** → **一覧**に出る → 別のキーワードで作成・保存 → 一覧が増える → **削除**できる。
4. 失敗時は下の切り分けを参照。

### つまずいたら

| 症状 | 主な原因 / 対処 |
| --- | --- |
| 保存が必ず 401 になる | 手順4未実施（JWT が HS256 のまま）。非対称鍵(ES256)へ切替＋ JWKS が EC 鍵を返すか確認。API を再起動。 |
| ログインボタンが出ない/無反応 | フロントの `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 未設定。`.env` を入れて Vite を再起動。 |
| Google 認証後に `redirect_uri_mismatch` | 6-1 の Authorized redirect URIs が `https://<ref>.supabase.co/auth/v1/callback` と一致していない。 |
| 認証後にアプリへ戻れない | 6-3 の Site URL / Redirect URLs に `http://localhost:5173` が無い。 |
| CORS エラー | サーバーの `WEB_ORIGIN=http://localhost:5173` を設定。 |
| 保存できるが他人のマップが見える | RLS 未適用。手順5-②を再実行し Policies が4つあるか確認。 |

> API キーの投入（`ANTHROPIC_API_KEY`）は [README のセットアップ](../README.md#セットアップ) を参照。
