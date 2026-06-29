-- T03 / DATABASE.md §3
-- mindmaps の RLS（Row Level Security）。本人（owner_id = auth.uid()）の行のみ CRUD を許可する。
-- 匿名（ゲスト）ユーザーは auth.uid() が NULL のためどのポリシーにもマッチせず保存系に到達不能（AC-8/AC-9）。
-- to authenticated に限定し、(select auth.uid()) で包んで行ごと再評価を避ける（Supabase 公式の最適化）。

-- RLS 有効化（有効化しただけでは全拒否。下のポリシーで本人のみ許可）
alter table public.mindmaps enable row level security;

-- SELECT: 本人の行のみ閲覧可（一覧・取得） — AC-10, AC-11
create policy mindmaps_select_own
  on public.mindmaps
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

-- INSERT: owner を自分にした行のみ作成可（他人を owner にした保存を拒否） — AC-9, AC-10
create policy mindmaps_insert_own
  on public.mindmaps
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

-- UPDATE: 本人の行のみ更新可。更新後も owner を自分以外に書き換え不可 — AC-10, AC-11
create policy mindmaps_update_own
  on public.mindmaps
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- DELETE: 本人の行のみ削除可 — AC-10, AC-11
create policy mindmaps_delete_own
  on public.mindmaps
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- 注: 別ユーザー2人で「自分のは見える / 他人のは見えない」を検証する RLS 回帰テストは
--     実 DB を要するため T13（maps CRUD 統合テスト）で実施する（DATABASE.md §4.2）。
