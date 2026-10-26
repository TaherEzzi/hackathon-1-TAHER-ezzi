-- fix_advisor_findings — resolves both `supabase db advisors` warnings from the
-- core_schema apply:
--
-- 1. security/anon+authenticated_security_definer_function_executable (WARN ×2)
--    public.handle_new_user() was reachable as an RPC. Triggers don't need the
--    EXECUTE privilege, so revoking it keeps the on-auth_user_created trigger
--    working while closing the /rest/v1/rpc path.
--
-- 2. performance/multiple_permissive_policies (WARN ×2)
--    "select own" + "select admin" permissive policies on the same table/role
--    double-evaluate per query. Merged into one policy with an OR.

-- 1. close the RPC path (trigger participation is unaffected)
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2a. profiles: one permissive SELECT policy
drop policy if exists "profiles_select_own"   on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or public.is_app_admin());

-- 2b. itineraries: one permissive SELECT policy
drop policy if exists "itineraries_select_own"   on public.itineraries;
drop policy if exists "itineraries_select_admin" on public.itineraries;
create policy "itineraries_select" on public.itineraries
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_app_admin());
