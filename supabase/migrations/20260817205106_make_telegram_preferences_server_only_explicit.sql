create policy "telegram_preferences_server_only"
on public.telegram_user_preferences
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

comment on policy "telegram_preferences_server_only"
on public.telegram_user_preferences
is 'Rejects direct client access explicitly. Backend service-role requests bypass RLS.';
