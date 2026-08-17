alter table public.telegram_user_preferences
  add column if not exists default_view text not null default 'main'
  check (default_view in ('main','quick','tools'));

comment on column public.telegram_user_preferences.default_view is 'Allowlisted Telegram default start experience: main, quick, or tools.';
