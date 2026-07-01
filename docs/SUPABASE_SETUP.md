# Supabase セットアップ手順（クラウド版）

Rensoo の**保存・一覧・再編集・削除**と**Google ログイン**を有効化するための手順です。
Supabase を設定しなくても、連想＋自走展開（ゲスト機能）はそのまま動きます（`AC-8`）。

- 対象: [supabase.com](https://supabase.com) のマネージドプロジェクト（Docker 不要）
- 前提コード: 認証は **JWKS(ES256) によるローカル検証**（[apps/api/src/http/middleware/auth.ts](../apps/api/src/http/middleware/auth.ts)）、
  永続化は **RLS で本人限定**（[supabase/migrations/](../supabase/migrations/)）。
- 所要: 15〜25 分。

> ⚠️ **つまずきポイント**: 本 API は Supabase の JWT を **非対称鍵(ES256/ECC)** の公開鍵（JWKS）で検証します。
> **2025-10-01 以降の新規プロジェクトは既定で ES256** なので通常は確認だけで済みます（手順4-1）。
> ただし**レガシーの HS256（共有シークレット）のままだと保存系 API が常に 401** になるため、
> その場合のみ手順4-2で非対称鍵へ移行してください。

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

## 4. JWT 署名鍵が非対称(ES256/ECC)であることを確認する

本 API は Supabase の JWT を **JWKS の公開鍵(ES256)** でローカル検証します。そのため署名鍵が
**非対称鍵（ES256/ECC）**である必要があります。

> ✅ **2025 年 10 月 1 日以降に作成した新規プロジェクトは、既定で非対称 JWT（ES256）です。**
> その場合この手順は**確認だけ**で完了し、移行操作は不要です（手順1で今作ったなら通常こちら）。
> 旧プロジェクトや、まだレガシー共有シークレット（HS256）のままの場合のみ、下の「移行」を行います。

ダッシュボードの **Settings → JWT Keys**（URL: `.../project/_/settings/jwt/signing-keys`）を開く。

### 4-1. まず確認（新規プロジェクトはここだけでOK）

JWKS エンドポイントをブラウザで開く:

```
https://<ref>.supabase.co/auth/v1/.well-known/jwks.json
```

`"kty":"EC"` かつ `"alg":"ES256"` を含む鍵（`keys` が空でない）が返れば、非対称鍵が有効＝**設定完了**。
（このエンドポイントは Supabase のエッジで約 10 分キャッシュされます。切替直後は反映待ちが生じることがあります。）

### 4-2. レガシー(HS256)のままだった場合のみ移行する

JWKS の `keys` が空、または署名鍵が **Legacy JWT Secret（HS256 共有シークレット）** の表示になっている場合:

1. **Settings → JWT Keys** で **「Migrate JWT secret」** を押す。
   → レガシー鍵が新方式に取り込まれ、**非対称鍵（ES256）が standby（スタンバイ）鍵**として作成される。
   （ダウンタイムなし。アルゴリズムは ES256 = NIST P-256 推奨。「Elliptic Curves は RSA より高速で同等の安全性」）
2. **「Rotate keys」** を押して standby 鍵を **現行（Current）署名鍵**に昇格させる。
   以後 Auth は新しい秘密鍵で JWT を発行し、公開鍵が JWKS で配布される。
3. （任意・本番運用時）アクセストークン有効期限＋余裕（例: 1 時間なら **1 時間 15 分**）待ってから、
   レガシーシークレットを revoke（無効化）する。開発では revoke まで行わなくても JWKS 検証は動く。
4. 再度 4-1 の JWKS を開き、`ES256` の EC 鍵が返ることを確認する。

> これで API 側の `createJwksVerifier`（issuer=`<URL>/auth/v1`, audience=`authenticated`）がトークンを検証できます。
> 検証は [apps/api/src/http/middleware/auth.ts](../apps/api/src/http/middleware/auth.ts) 参照。

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
| 保存が必ず 401 になる | JWT がレガシー HS256 のまま（手順4-1の JWKS が空/EC鍵なし）。手順4-2で「Migrate JWT secret」→「Rotate keys」を実施し、JWKS が ES256 の EC 鍵を返すか確認。API を再起動。 |
| ログインボタンが出ない/無反応 | フロントの `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 未設定。`.env` を入れて Vite を再起動。 |
| Google 認証後に `redirect_uri_mismatch` | 6-1 の Authorized redirect URIs が `https://<ref>.supabase.co/auth/v1/callback` と一致していない。 |
| 認証後にアプリへ戻れない | 6-3 の Site URL / Redirect URLs に `http://localhost:5173` が無い。 |
| CORS エラー | サーバーの `WEB_ORIGIN=http://localhost:5173` を設定。 |
| 保存できるが他人のマップが見える | RLS 未適用。手順5-②を再実行し Policies が4つあるか確認。 |

> API キーの投入（`ANTHROPIC_API_KEY`）は [README のセットアップ](../README.md#セットアップ) を参照。
