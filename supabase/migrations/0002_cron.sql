-- Momentum: zeitgesteuerte Aufrufe der Edge Functions (pg_cron + pg_net)
-- Einmalig im Supabase SQL Editor ausfuehren (kann gefahrlos erneut ausgefuehrt werden).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Geheimnis, mit dem sich die Datenbank bei den Edge Functions ausweist.
-- Es wird hier zufaellig erzeugt und verlaesst die Datenbank nie.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.config (
  key text primary key,
  value text not null
);

insert into private.config (key, value)
values ('cron_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- Die Edge Function fragt hiermit, ob das mitgeschickte Geheimnis stimmt
create or replace function public.check_cron_secret(candidate text) returns boolean
language sql security definer set search_path = '' as $$
  select exists (select 1 from private.config where key = 'cron_secret' and value = candidate);
$$;
revoke all on function public.check_cron_secret(text) from public, anon, authenticated;
grant execute on function public.check_cron_secret(text) to service_role;

-- Ruft eine Edge Function mit dem Geheimnis auf
create or replace function private.call_edge_function(function_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://ipkslnklfbigfxmajazo.supabase.co/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from private.config where key = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end $$;

-- Kalender jede Stunde abgleichen (5 Minuten nach der vollen Stunde)
select cron.schedule('momentum-sync-calendar', '5 * * * *', $$select private.call_edge_function('sync-calendar')$$);
