-- 会社全体で共有するアプリ状態（1行・JSON）
-- 既存の user_app_state（個人別）は残しますが、クライアントは shared_app_state を使います。

create table if not exists public.shared_app_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint shared_app_state_single_row check (id = 'default')
);

create index if not exists shared_app_state_updated_at_idx
  on public.shared_app_state (updated_at desc);

alter table public.shared_app_state enable row level security;

-- ログイン済みユーザー全員が同じ行を読める
create policy "shared_app_state_select_authenticated"
  on public.shared_app_state for select
  to authenticated
  using (id = 'default');

-- 共有行の作成（初回 upsert 用）
create policy "shared_app_state_insert_authenticated"
  on public.shared_app_state for insert
  to authenticated
  with check (id = 'default');

create policy "shared_app_state_update_authenticated"
  on public.shared_app_state for update
  to authenticated
  using (id = 'default')
  with check (id = 'default');

create policy "shared_app_state_delete_authenticated"
  on public.shared_app_state for delete
  to authenticated
  using (id = 'default');

-- 任意: 旧 user_app_state のうち最新1件を共有ストアに移す（手動で SQL エディタから実行）
-- insert into public.shared_app_state (id, payload, updated_at)
-- select 'default', u.payload, u.updated_at
-- from public.user_app_state u
-- order by u.updated_at desc
-- limit 1
-- on conflict (id) do update
--   set payload = excluded.payload, updated_at = excluded.updated_at;
