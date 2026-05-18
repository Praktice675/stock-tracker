create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  total_value numeric not null,
  taken_at timestamptz not null default now()
);

create index if not exists portfolio_snapshots_user_time_idx
  on public.portfolio_snapshots(user_id, taken_at desc);

alter table public.portfolio_snapshots enable row level security;

drop policy if exists "snapshots_select_own" on public.portfolio_snapshots;
create policy "snapshots_select_own" on public.portfolio_snapshots
  for select using (auth.uid() = user_id);

drop policy if exists "snapshots_insert_own" on public.portfolio_snapshots;
create policy "snapshots_insert_own" on public.portfolio_snapshots
  for insert with check (auth.uid() = user_id);
