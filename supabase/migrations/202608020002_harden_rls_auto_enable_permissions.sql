-- Supabase Security Advisor hardening.
-- Some hosted projects include this project-level event-trigger function,
-- while a clean local Supabase stack may not. Apply the ACL hardening only
-- when the function exists so the migration remains portable and idempotent.

do $permissions$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable()
      from public, anon, authenticated;

    grant execute on function public.rls_auto_enable()
      to postgres, service_role;

    comment on function public.rls_auto_enable() is
      'Internal event-trigger function that automatically enables RLS on new public tables. Not callable by application roles.';
  end if;
end;
$permissions$;
