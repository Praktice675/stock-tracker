create table if not exists public.ticker_logos (
  ticker text primary key,
  domain text,
  logo_url text,
  fetched_at timestamptz not null default now()
);

-- Public read; only service role writes (this is shared cache, not per-user)
alter table public.ticker_logos enable row level security;

drop policy if exists "logos_read_all" on public.ticker_logos;
create policy "logos_read_all" on public.ticker_logos
  for select using (true);
