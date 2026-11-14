-- Momentum: Datenmodell + Row Level Security
-- Einmalig im Supabase SQL Editor ausfuehren (kann gefahrlos erneut ausgefuehrt werden).

-- ---------------------------------------------------------------------------
-- Sync-Hilfe: "last write wins" ueber updated_at, synced_at als Abhol-Marke
-- ---------------------------------------------------------------------------
create or replace function public.sync_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Aeltere Aenderung von einem anderen Geraet ueberschreibt keine neuere
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  emoji text not null default '',
  color text not null default '#6366f1',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  type text not null check (type in ('project', 'appointment', 'savings')),
  progress_mode text not null check (progress_mode in ('checklist', 'numeric', 'time', 'countdown')),
  start_date date,
  due_date date,
  current_value numeric,
  target_value numeric,
  unit text,
  note text,
  source text not null default 'manual' check (source in ('manual', 'calendar')),
  calendar_uid text,
  status text not null default 'active' check (status in ('active', 'done', 'archived')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);
create unique index if not exists events_calendar_uid_key
  on public.events (user_id, calendar_uid) where calendar_uid is not null;

create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  done_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  frequency text not null check (frequency in ('daily', 'weekly')),
  times_per_week integer check (times_per_week between 1 and 7),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

-- id = "<habit_id>:<datum>", damit zwei Geraete denselben Tag nicht doppelt anlegen
create table if not exists public.habit_checks (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now(),
  unique (habit_id, date)
);

create table if not exists public.inbox_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  ical_url text,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  notify_evening boolean not null default true,
  notify_countdown boolean not null default true,
  notify_achievement boolean not null default true,
  notify_weekly boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  device_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  ref_id text,
  sent_at timestamptz not null default now()
);
create index if not exists notification_log_user_sent on public.notification_log (user_id, sent_at);

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ---------------------------------------------------------------------------
-- Trigger, Indizes, Rechte und Row Level Security fuer die Sync-Tabellen
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['categories', 'events', 'subtasks', 'habits', 'habit_checks', 'inbox_tasks', 'settings']
  loop
    execute format('drop trigger if exists sync_touch on public.%I', t);
    execute format('create trigger sync_touch before insert or update on public.%I for each row execute function public.sync_touch()', t);
    execute format('create index if not exists %I on public.%I (user_id, synced_at)', t || '_user_synced', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format('create policy own_rows on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

alter table public.push_subscriptions enable row level security;
drop policy if exists own_rows on public.push_subscriptions;
create policy own_rows on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Nur lesen: geschrieben wird von den Edge Functions (Service-Rolle)
alter table public.notification_log enable row level security;
drop policy if exists own_rows_read on public.notification_log;
create policy own_rows_read on public.notification_log for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.notification_log to authenticated;

alter table public.weekly_reviews enable row level security;
drop policy if exists own_rows_read on public.weekly_reviews;
create policy own_rows_read on public.weekly_reviews for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.weekly_reviews to authenticated;

-- ---------------------------------------------------------------------------
-- Erste Anmeldung: Einstellungen + Start-Kategorien anlegen (nur einmal)
-- ---------------------------------------------------------------------------
create or replace function public.init_user() returns void
language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
  inserted integer;
begin
  if uid is null then
    raise exception 'Nicht angemeldet';
  end if;

  insert into public.settings (user_id) values (uid) on conflict (user_id) do nothing;
  get diagnostics inserted = row_count;

  if inserted = 1 then
    insert into public.categories (user_id, name, emoji, color, sort_order) values
      (uid, 'Ausbildung & Schule', '🎓', '#6366f1', 0),
      (uid, 'Gesundheit & Gym',    '💪', '#10b981', 1),
      (uid, 'Finanzen',            '💰', '#f59e0b', 2),
      (uid, 'Reisen',              '✈️', '#0ea5e9', 3),
      (uid, 'Privat',              '🏠', '#ec4899', 4);
  end if;
end $$;

revoke all on function public.init_user() from public, anon;
grant execute on function public.init_user() to authenticated;
