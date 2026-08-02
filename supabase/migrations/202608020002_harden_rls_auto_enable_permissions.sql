-- Supabase Security Advisor hardening.
-- The project-level event trigger automatically enables RLS on new tables,
-- but application roles must never call its SECURITY DEFINER function via RPC.

revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;

grant execute on function public.rls_auto_enable()
  to postgres, service_role;

comment on function public.rls_auto_enable() is
  'Internal event-trigger function that automatically enables RLS on new public tables. Not callable by application roles.';
