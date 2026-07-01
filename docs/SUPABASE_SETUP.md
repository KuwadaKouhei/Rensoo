# Supabase セットアップ手順（クラウド版）

Rensoo の**保存・一覧・再編集・削除**と**Google ログイン**を有効化するための手順です。
Supabase を設定しなくても、連想＋自走展開（ゲスト機能）はそのまま動きます（`AC-8`）。

- 対象: [supabase.com](https://supabase.com) のマネージドプロジェクト（Docker 不要）
- 前提コード: 認証は **JWKS(ES256) によるローカル検証**（[apps/api/src/http/middleware/auth.ts](../apps/api/src/http/middleware/auth.ts)）、
  永続化は **RLS で本人限定**（[supabase/migrations/](../supabase/migrations/)）。
- 所要: 15〜25 分。

> ⚠️ **一番つまずくのは手順4（JWT鍵）ですが、実際にやることは「URLを1つ開いて中身を見るだけ」です。**
> 今から作る新規プロジェクトなら、ほぼ確認だけで終わります。詳しくは手順4で丁寧に説明します。

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

## 4. JWT 鍵をチェックする（1分・URLを開いて見るだけ）

**この節でやること**: ログインの本人確認に使う「鍵」が正しい形式か、URL を1つ開いて確かめるだけです。

<details>
<summary>なぜ必要？（読み飛ばしOK）</summary>

ログインすると Supabase が「あなたは本人だ」という証明書（JWT）を発行します。Rensoo のサーバーは
その証明書を**公開鍵で検証**します。この方式には**新しい形式の鍵（ES256）**が必要で、
**古い形式（HS256）のままだと保存が必ず失敗（401）**します。だから最初に鍵の形式を確認します。
</details>

### 手順4-A：チェックする

1. ブラウザのアドレスバーに次の URL を入力して開く（**`<ref>` を自分の値に置き換える**）:

   ```
   https://<ref>.supabase.co/auth/v1/.well-known/jwks.json
   ```

   > `<ref>` は手順2で控えた **Project URL** の `https://ここ.supabase.co` の部分です。
   > 例: Project URL が `https://abcdefgh.supabase.co` なら `<ref>` は `abcdefgh`。

2. 表示された文字（JSON）を見て、どちらかを判断する:

   **✅ OKパターン** — `keys` の中身があり、`"alg":"ES256"` が入っている。→ **手順4は完了。手順5へ進む。**
   ```json
   { "keys": [ { "kty": "EC", "alg": "ES256", "crv": "P-256", ... } ] }
   ```

   **⚠️ 直しが必要なパターン** — `keys` が空っぽ。→ **手順4-B に進む。**
   ```json
   { "keys": [] }
   ```

> 今から作った新規プロジェクト（2025年10月以降）は、ほぼ必ず **✅ OKパターン**です。その場合は何も操作せず手順5へ。

### 手順4-B：空っぽ（⚠️）だったときだけ、2クリックで直す

古い形式（HS256）のプロジェクトのときだけ必要です。ダッシュボードで:

1. 左メニュー **Settings（歯車）→ JWT Keys** を開く。
2. **「Migrate JWT secret」** ボタンを押す。（新しい形式の鍵が「予備」として自動で作られます）
3. **「Rotate keys」** ボタンを押す。（予備の鍵が「本番の鍵」に切り替わります）
4. 30秒ほど待ってから、**手順4-A の URL をもう一度開いて再読み込み**し、`"alg":"ES256"` が出れば完了。

> - この2ボタンだけで OK です。「revoke（古い鍵の無効化）」は本番運用のときに行う後片付けで、**開発では不要**です。
> - URL は約10分キャッシュされるため、切替直後に古い表示が残ることがあります。少し待って再読み込みしてください。

<details>
<summary>技術メモ（担当者向け）</summary>

サーバーは JWKS の公開鍵で JWT を検証します（`createJwksVerifier`, issuer=`<URL>/auth/v1`,
audience=`authenticated`）。実装は [apps/api/src/http/middleware/auth.ts](../apps/api/src/http/middleware/auth.ts)。
鍵は ES256（NIST P-256）を推奨（ECC は RSA より高速で同等の安全性）。
</details>

## 5. マイグレーションを適用する（テーブル＋RLS）

**SQL Editor** で、次の2ファイルを**この順に**貼り付けて実行する（順序が重要: テーブル → RLS）。

1. [supabase/migrations/20260626090000_create_mindmaps.sql](../supabase/migrations/20260626090000_create_mindmaps.sql)
   （`mindmaps` テーブル・インデックス・`updated_at` 自動更新トリガ）
2. [supabase/migrations/20260626090100_mindmaps_rls.sql](../supabase/migrations/20260626090100_mindmaps_rls.sql)
   （RLS 有効化＋本人限定の SELECT/INSERT/UPDATE/DELETE ポリシー）

適用後、**Table Editor** に `mindmaps` が現れ、**Authentication → Policies** に4つのポリシーが表示されれば成功。

> Supabase CLI を使う場合は代わりに `supabase link --project-ref <ref>` → `supabase db push` でも適用できます。

## 6. Google ログインを設定する

**全体像**: Google 側で「鍵（Client ID / Secret）」を作り、それを Supabase に貼り付け、最後に戻り先 URL を許可する——**3ステップ**です。

```
6-A) Supabaseで戻り先URLをコピー → 6-B) Googleで鍵を作る → 6-C) Supabaseに鍵を貼り、戻り先URLを許可
```

> 💡 コツ: 先に **6-A で「戻り先 URL」をコピー**しておくと、6-B で貼るだけで済み、打ち間違い（一番多い失敗）を防げます。

### 手順6-A：Supabase で「戻り先 URL」をコピーする

1. Supabase ダッシュボードで **Authentication（左メニュー）→ Providers → Google** を開く。
2. **Callback URL (for OAuth)** という欄に表示されている URL をコピーする。
   - 形は `https://<ref>.supabase.co/auth/v1/callback`。この画面はまだ開いたままにしておく（6-C で使う）。

### 手順6-B：Google 側で「鍵」を作る

別タブで [Google Cloud Console](https://console.cloud.google.com/) を開く。

1. プロジェクトを用意（無ければ新規作成。既存でも可）。
2. **左メニュー → APIs & Services → OAuth consent screen（同意画面）** を設定:
   - User Type は **External** を選ぶ。
   - アプリ名・サポートメールを入力して保存。
   - **Test users** に**自分の Google アドレスを追加**する（審査前はここに入れた人だけログインできる）。
3. **APIs & Services → Credentials → ＋ Create Credentials → OAuth client ID** を選ぶ。
   - **Application type**: **Web application** を選択。
   - **Authorized JavaScript origins** に `http://localhost:5173` を追加。
   - **Authorized redirect URIs** に、**6-A でコピーした URL をそのまま貼り付ける**
     （`https://<ref>.supabase.co/auth/v1/callback`）。
   - **Create** を押す。
4. 表示される **Client ID** と **Client Secret** をコピーする（6-C で使う）。

### 手順6-C：Supabase に鍵を貼り、戻り先を許可する

6-A で開いたままの Supabase タブに戻る。

1. **Authentication → Providers → Google** で:
   - **Enable Sign in with Google** をオンにする。
   - **Client ID** と **Client Secret（keys）** に 6-B の値を貼り付け、**Save**。
2. **Authentication → URL Configuration** を開き、ログイン後の戻り先を許可する:
   - **Site URL**: `http://localhost:5173` を入力。
   - **Redirect URLs**: `http://localhost:5173` を追加。
   - **Save**。

> 本番公開時は、上記の `http://localhost:5173` の代わりに本番のURL（例 `https://your-app.com`）を、
> 6-B の JavaScript origins と 6-C の Site URL / Redirect URLs の両方に追加します。
> フロントは「今開いているオリジンへ戻る」実装です（[apps/web/src/auth/supabaseClient.ts](../apps/web/src/auth/supabaseClient.ts) の `redirectTo: window.location.origin`）。

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
| 保存が必ず 401 になる | JWT が古い形式のまま（手順4-A の URL で `keys` が空）。手順4-B の「Migrate JWT secret」→「Rotate keys」を実施し、`"alg":"ES256"` が出るのを確認してから API を再起動。 |
| ログインボタンが出ない/無反応 | フロントの `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 未設定。`.env` を入れて Vite を再起動。 |
| Google 認証後に `redirect_uri_mismatch` | 手順6-B の Authorized redirect URIs が、6-A でコピーした `https://<ref>.supabase.co/auth/v1/callback` と一字一句一致していない。貼り直す。 |
| 認証後にアプリへ戻れない | 手順6-C の Site URL / Redirect URLs に `http://localhost:5173` が無い。 |
| `access_blocked` / このアプリは確認されていません | 手順6-B の OAuth consent screen の Test users に自分の Google アドレスを追加していない。 |
| CORS エラー | サーバーの `WEB_ORIGIN=http://localhost:5173` を設定。 |
| 保存できるが他人のマップが見える | RLS 未適用。手順5-②を再実行し Policies が4つあるか確認。 |

> API キーの投入（`ANTHROPIC_API_KEY`）は [README のセットアップ](../README.md#セットアップ) を参照。
