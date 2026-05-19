-- Track Stripe subscription state per user
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text not null default 'free',          -- 'free' | 'plus'
  status text,                                 -- Stripe subscription status: active, trialing, past_due, canceled, etc.
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subs_select_own" on public.subscriptions;
create policy "subs_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

-- No insert/update/delete policies for users — only the service role (webhook handler) writes to this table.

create index if not exists subscriptions_customer_idx on public.subscriptions(stripe_customer_id);
