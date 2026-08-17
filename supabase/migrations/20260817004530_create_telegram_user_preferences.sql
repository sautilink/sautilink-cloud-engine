create table if not exists public.telegram_user_preferences (
  telegram_user_id bigint primary key,
  locale text not null check (locale in ('en','sw')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_user_preferences enable row level security;

revoke all on table public.telegram_user_preferences from anon, authenticated;
grant select, insert, update on table public.telegram_user_preferences to service_role;

comment on table public.telegram_user_preferences is 'Durable Telegram presentation preferences for SautiLink Cloud Engine. Server-side access only.';
comment on column public.telegram_user_preferences.telegram_user_id is 'Telegram numeric user ID; not a Supabase Auth user ID.';
comment on column public.telegram_user_preferences.locale is 'Allowlisted Telegram UI locale: en or sw.';
