alter table public.telegram_user_preferences
  add column if not exists report_detail text not null default 'compact'
    check (report_detail in ('compact', 'detailed')),
  add column if not exists developer_mode boolean not null default false;

comment on column public.telegram_user_preferences.report_detail is 'Telegram report presentation preference: compact or detailed.';
comment on column public.telegram_user_preferences.developer_mode is 'Telegram developer-mode presentation preference. Does not expose internal SautiLink infrastructure.';
