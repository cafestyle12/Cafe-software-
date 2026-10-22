drop policy if exists "profiles read self" on public.profiles;
drop policy if exists "profiles read tenant colleagues" on public.profiles;
create policy "profiles read self or tenant colleagues" on public.profiles
for select to authenticated using (user_id = (select auth.uid()) or private.shares_tenant(user_id));
