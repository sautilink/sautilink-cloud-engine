alter table public.account_profiles
  add column if not exists whatsapp_verified_at timestamptz;

comment on column public.account_profiles.whatsapp_verified_at is
  'Server-owned timestamp proving the current WhatsApp number completed verification. Clients cannot write this column.';

alter table public.account_profiles
  drop constraint if exists account_profiles_whatsapp_opt_in_requires_number;

alter table public.account_profiles
  add constraint account_profiles_whatsapp_opt_in_requires_verified_number check (
    whatsapp_updates = false
    or (whatsapp_e164 is not null and whatsapp_verified_at is not null)
  );

revoke update on table public.account_profiles from authenticated;
grant update (username, full_name, avatar_url, email_updates, whatsapp_e164, whatsapp_updates, updated_at)
  on table public.account_profiles to authenticated;

create or replace function private.reset_whatsapp_verification_on_number_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.whatsapp_e164 is distinct from old.whatsapp_e164 then
    new.whatsapp_verified_at := null;
    new.whatsapp_updates := false;
  end if;
  return new;
end;
$$;

revoke all on function private.reset_whatsapp_verification_on_number_change() from public;
revoke all on function private.reset_whatsapp_verification_on_number_change() from anon;
revoke all on function private.reset_whatsapp_verification_on_number_change() from authenticated;

drop trigger if exists reset_account_whatsapp_verification on public.account_profiles;
create trigger reset_account_whatsapp_verification
before update of whatsapp_e164 on public.account_profiles
for each row execute function private.reset_whatsapp_verification_on_number_change();
