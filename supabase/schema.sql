-- TraderBross: Base auth/app schema for Supabase
-- Run in Supabase SQL editor (or as your first migration).

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled')),
  current_period_end timestamptz,
  provider text default 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger user_subscriptions_updated_at
before update on public.user_subscriptions
for each row execute procedure public.set_updated_at();

create table if not exists public.user_watchlist_items (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, symbol)
);

create index if not exists user_watchlist_items_user_sort_idx
  on public.user_watchlist_items (user_id, sort_order);

create table if not exists public.user_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  ticker text,
  keyword text,
  sentiment text check (sentiment in ('bullish', 'bearish', 'neutral')),
  price_above numeric,
  price_below numeric,
  enabled boolean not null default true,
  triggered_count int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_alerts_user_created_idx
  on public.user_alerts (user_id, created_at desc);

create trigger user_alerts_updated_at
before update on public.user_alerts
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.user_subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.user_watchlist_items enable row level security;
alter table public.user_alerts enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "subscriptions_select_own" on public.user_subscriptions;
create policy "subscriptions_select_own"
on public.user_subscriptions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "watchlist_read_own" on public.user_watchlist_items;
create policy "watchlist_read_own"
on public.user_watchlist_items
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "watchlist_insert_own" on public.user_watchlist_items;
create policy "watchlist_insert_own"
on public.user_watchlist_items
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "watchlist_update_own" on public.user_watchlist_items;
create policy "watchlist_update_own"
on public.user_watchlist_items
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "watchlist_delete_own" on public.user_watchlist_items;
create policy "watchlist_delete_own"
on public.user_watchlist_items
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "alerts_read_own" on public.user_alerts;
create policy "alerts_read_own"
on public.user_alerts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "alerts_insert_own" on public.user_alerts;
create policy "alerts_insert_own"
on public.user_alerts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "alerts_update_own" on public.user_alerts;
create policy "alerts_update_own"
on public.user_alerts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "alerts_delete_own" on public.user_alerts;
create policy "alerts_delete_own"
on public.user_alerts
for delete
to authenticated
using (auth.uid() = user_id);
