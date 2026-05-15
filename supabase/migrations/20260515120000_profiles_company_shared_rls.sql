-- テナント（会社）ごとに shared_app_state を分離し、自社の行だけ触れるようにする。
-- 前提: public.shared_app_state が既に存在し id 列がある（20260514120000）場合は company_id に移行する。

-- 1) ユーザーの所属会社（新規登録時は raw_user_meta_data.company_id、なければ default）
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  company_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists profiles_company_id_idx on public.profiles (company_id);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = user_id);

-- クライアントからの直接 INSERT/UPDATE は不可（トリガーが security definer で作成）

-- 2) 新規 auth ユーザーに profiles を付与
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, company_id)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'company_id'), ''), 'default')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- 3) 既存ユーザーに profiles を補完
insert into public.profiles (user_id, company_id)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data->>'company_id'), ''), 'default')
from auth.users u
on conflict (user_id) do nothing;

-- 4) shared_app_state: id 列 → company_id 主キーへ移行（既に company_id のみならスキップ）
do $$
begin
  if to_regclass('public.shared_app_state') is null then
    create table public.shared_app_state (
      company_id text primary key,
      payload jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );
    create index if not exists shared_app_state_updated_at_idx
      on public.shared_app_state (updated_at desc);
    alter table public.shared_app_state enable row level security;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shared_app_state'
      and column_name = 'id'
  ) then
    drop policy if exists "shared_app_state_select_authenticated" on public.shared_app_state;
    drop policy if exists "shared_app_state_insert_authenticated" on public.shared_app_state;
    drop policy if exists "shared_app_state_update_authenticated" on public.shared_app_state;
    drop policy if exists "shared_app_state_delete_authenticated" on public.shared_app_state;

    alter table public.shared_app_state add column if not exists company_id text;
    update public.shared_app_state set company_id = id where company_id is null;

    alter table public.shared_app_state drop constraint if exists shared_app_state_single_row;
    alter table public.shared_app_state drop constraint if exists shared_app_state_pkey;

    alter table public.shared_app_state drop column if exists id;

    alter table public.shared_app_state alter column company_id set not null;
    alter table public.shared_app_state add primary key (company_id);

    create index if not exists shared_app_state_updated_at_idx
      on public.shared_app_state (updated_at desc);
  end if;
end $$;

-- 5) 会社スコープの RLS（profiles.company_id と一致する行のみ）
alter table public.shared_app_state enable row level security;

drop policy if exists "shared_app_state_select_authenticated" on public.shared_app_state;
drop policy if exists "shared_app_state_insert_authenticated" on public.shared_app_state;
drop policy if exists "shared_app_state_update_authenticated" on public.shared_app_state;
drop policy if exists "shared_app_state_delete_authenticated" on public.shared_app_state;
drop policy if exists "shared_app_state_select_company" on public.shared_app_state;
drop policy if exists "shared_app_state_insert_company" on public.shared_app_state;
drop policy if exists "shared_app_state_update_company" on public.shared_app_state;
drop policy if exists "shared_app_state_delete_company" on public.shared_app_state;

create policy "shared_app_state_select_company"
  on public.shared_app_state for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = shared_app_state.company_id
    )
  );

create policy "shared_app_state_insert_company"
  on public.shared_app_state for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = company_id
    )
  );

create policy "shared_app_state_update_company"
  on public.shared_app_state for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = shared_app_state.company_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = company_id
    )
  );

create policy "shared_app_state_delete_company"
  on public.shared_app_state for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = shared_app_state.company_id
    )
  );

-- 既存ユーザーを新しい VITE_COMPANY_ID に揃える例（必要なら SQL エディタで実行）:
-- update public.profiles set company_id = 'あなたのスラッグ' where company_id = 'default';
