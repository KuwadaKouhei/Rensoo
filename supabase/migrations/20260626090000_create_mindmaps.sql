-- T03 / DATABASE.md §2.3, §2.4
-- mindmaps テーブル（JSONB スナップショット案）・index・updated_at 自動更新トリガを作成する。
-- 認可ポリシー（RLS）は関心を分離し、後続の 20260626090100_mindmaps_rls.sql で定義する。

-- gen_random_uuid() 用（Supabase は既定で利用可）
create extension if not exists pgcrypto;

create table public.mindmaps (
  id           uuid        primary key default gen_random_uuid(),
  -- 所有者。auth.users を直接参照し、本アプリ独自の users テーブルは作らない（DATABASE.md §2.2）。
  -- ユーザー削除で本人のマップも自動削除（孤児行を残さない）。
  owner_id     uuid        not null references auth.users (id) on delete cascade,
  title        text        not null default '無題のマップ'
                           check (char_length(title) between 1 and 100),
  root_keyword text        not null
                           check (char_length(root_keyword) between 1 and 100),
  -- 生成設定（既定 6/2/50。maxDepth=2＝自動生成は第2世代まで）。範囲検証の正本はアプリ層 Zod。DB はキー存在＋数値型のみ守る。
  settings     jsonb       not null
                           default '{"countPerNode":6,"maxDepth":2,"maxNodes":50}'::jsonb
                           check (
                             jsonb_typeof(settings->'countPerNode') = 'number'
                             and jsonb_typeof(settings->'maxDepth')   = 'number'
                             and jsonb_typeof(settings->'maxNodes')   = 'number'
                           ),
  -- ノード/エッジのスナップショット。詳細整合（孤立エッジ禁止 AC-7）はアプリ層 Zod。
  snapshot     jsonb       not null
                           check (
                             snapshot ? 'nodes' and snapshot ? 'edges'
                             and jsonb_typeof(snapshot->'nodes') = 'array'
                             and jsonb_typeof(snapshot->'edges') = 'array'
                           ),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 一覧取得（本人のマップを更新日時の新しい順）用の複合インデックス（FR-21 / AC-10）。
create index idx_mindmaps_owner_updated
  on public.mindmaps (owner_id, updated_at desc);

-- updated_at 自動更新トリガ
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_mindmaps_updated_at
  before update on public.mindmaps
  for each row execute function public.set_updated_at();
