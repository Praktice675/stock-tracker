-- Profiles table (one row per user, created automatically on signup)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamp with time zone default now()
);

-- Auto-create profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Watchlist items
create table public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  name text not null,
  position integer not null default 0,
  added_at timestamp with time zone default now(),
  unique(user_id, ticker)
);

create index watchlist_items_user_id_idx on public.watchlist_items(user_id);

-- Portfolio transactions (one row per buy/sell)
create table public.portfolio_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  type text not null check (type in ('buy', 'sell')),
  shares numeric not null check (shares > 0),
  price numeric not null check (price > 0),
  executed_at timestamp with time zone default now(),
  notes text
);

create index portfolio_transactions_user_id_idx on public.portfolio_transactions(user_id);
create index portfolio_transactions_ticker_idx on public.portfolio_transactions(user_id, ticker);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.portfolio_transactions enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Watchlist: users can do anything to their own items
create policy "Users can view own watchlist" on public.watchlist_items
  for select using (auth.uid() = user_id);
create policy "Users can insert own watchlist items" on public.watchlist_items
  for insert with check (auth.uid() = user_id);
create policy "Users can update own watchlist items" on public.watchlist_items
  for update using (auth.uid() = user_id);
create policy "Users can delete own watchlist items" on public.watchlist_items
  for delete using (auth.uid() = user_id);

-- Portfolio: same pattern
create policy "Users can view own transactions" on public.portfolio_transactions
  for select using (auth.uid() = user_id);
create policy "Users can insert own transactions" on public.portfolio_transactions
  for insert with check (auth.uid() = user_id);
create policy "Users can update own transactions" on public.portfolio_transactions
  for update using (auth.uid() = user_id);
create policy "Users can delete own transactions" on public.portfolio_transactions
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Phase B1: brokerage connections (SnapTrade)
-- Run the section below in the SQL editor before testing the new flow.
-- ------------------------------------------------------------------
create table public.brokerage_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snaptrade_user_id text not null,
  snaptrade_user_secret text not null,
  -- 'pending' until SnapTrade hands the user back to us with a real auth id.
  authorization_id text not null,
  broker_slug text not null default '',
  broker_name text not null default '',
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  status text not null default 'active',
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);

create index brokerage_connections_user_id_idx on public.brokerage_connections(user_id);

alter table public.brokerage_connections enable row level security;

create policy "users see own connections" on public.brokerage_connections
  for select using (auth.uid() = user_id);
create policy "users insert own connections" on public.brokerage_connections
  for insert with check (auth.uid() = user_id);
create policy "users update own connections" on public.brokerage_connections
  for update using (auth.uid() = user_id);
create policy "users delete own connections" on public.brokerage_connections
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Chat quota: per-user daily message counter for /api/chat rate limit.
-- INSERTs/UPDATEs run via the service role from the server route so the
-- only client-facing policy is SELECT.
-- ------------------------------------------------------------------
create table public.chat_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  message_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, usage_date)
);

create index chat_usage_user_id_date_idx on public.chat_usage(user_id, usage_date);

alter table public.chat_usage enable row level security;

create policy "users see own usage" on public.chat_usage
  for select using (auth.uid() = user_id);
