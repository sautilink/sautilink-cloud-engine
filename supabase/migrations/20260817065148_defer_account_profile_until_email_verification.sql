drop trigger if exists on_auth_user_created_sautilink_account on auth.users;
drop function if exists private.handle_new_sautilink_account();

comment on table public.account_profiles is
  'Private SautiLink Account profile data shared across SautiLink products. Rows are created only after successful email verification; verification remains authoritative in Supabase Auth.';
