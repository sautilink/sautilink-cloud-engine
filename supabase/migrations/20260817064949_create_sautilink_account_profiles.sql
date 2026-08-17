create schema if not exists private;

create table public.account_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null,
  avatar_url text,
  email_updates boolean not null default false,
  whatsapp_e164 text,
  whatsapp_updates boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_profiles_username_format check (
    username = lower(username)
    and username ~ '^[a-z0-9][a-z0-9._]{2,29}$'
  ),
  constraint account_profiles_username_reserved check (
    username <> all (array[
      'admin','administrator','root','support','security','sautilink','cloudengine',
      'official','api','help','about','settings','login','signup','account'
    ]::text[])
  ),
  constraint account_profiles_full_name_length check (
    char_length(btrim(full_name)) between 1 and 80
  ),
  constraint account_profiles_whatsapp_e164 check (
    whatsapp_e164 is null or whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'
  ),
  constraint account_profiles_whatsapp_opt_in_requires_number check (
    whatsapp_updates = false or whatsapp_e164 is not null
  )
);

comment on table public.account_profiles is
  'Private SautiLink Account profile data shared across SautiLink products. Email verification remains authoritative in Supabase Auth.';
comment on column public.account_profiles.username is
  'Future-facing SautiLink handle. Lowercase, globally unique, and not used as an authorization claim.';
comment on column public.account_profiles.email_updates is
  'Explicit opt-in for non-essential SautiLink ecosystem email updates; false by default.';
comment on column public.account_profiles.whatsapp_updates is
  'Explicit opt-in for non-essential SautiLink ecosystem WhatsApp updates; false by default.';

alter table public.account_profiles enable row level security;

revoke all on table public.account_profiles from anon;
revoke all on table public.account_profiles from authenticated;
grant select, update on table public.account_profiles to authenticated;

create policy "account_profiles_select_own"
on public.account_profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "account_profiles_update_own"
on public.account_profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create or replace function private.handle_new_sautilink_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  requested_full_name text;
begin
  requested_username := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  requested_full_name := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  if requested_username = '' or requested_full_name = '' then
    raise exception 'SautiLink account profile metadata is incomplete';
  end if;

  insert into public.account_profiles (
    id,
    username,
    full_name,
    email_updates,
    whatsapp_updates
  ) values (
    new.id,
    requested_username,
    requested_full_name,
    false,
    false
  );

  return new;
end;
$$;

revoke all on function private.handle_new_sautilink_account() from public;
revoke all on function private.handle_new_sautilink_account() from anon;
revoke all on function private.handle_new_sautilink_account() from authenticated;

create trigger on_auth_user_created_sautilink_account
after insert on auth.users
for each row execute function private.handle_new_sautilink_account();
