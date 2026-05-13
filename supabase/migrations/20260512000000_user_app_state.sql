-- 営業データ分析: ユーザーごとのアプリ状態（JSON）
-- Supabase SQL エディタ、または supabase db push で適用

create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists user_app_state_updated_at_idx
  on public.user_app_state (updated_at desc);

alter table public.user_app_state enable row level security;

create policy "user_app_state_select_own"
  on public.user_app_state for select
  using (auth.uid() = user_id);

create policy "user_app_state_insert_own"
  on public.user_app_state for insert
  with check (auth.uid() = user_id);

create policy "user_app_state_update_own"
  on public.user_app_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_app_state_delete_own"
  on public.user_app_state for delete
  using (auth.uid() = user_id);
