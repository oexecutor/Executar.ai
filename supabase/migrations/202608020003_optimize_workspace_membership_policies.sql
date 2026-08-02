-- Supabase Performance Advisor hardening.
-- Keep one SELECT policy and split administrative writes by command so RLS
-- does not evaluate multiple permissive policies for the same read.

 drop policy if exists memberships_select_self_or_admin
   on public.workspace_memberships;
 create policy memberships_select_self_or_admin
   on public.workspace_memberships
   for select to authenticated
   using (
     user_id = (select auth.uid())
     or app.has_workspace_role(workspace_id, array['OWNER', 'ADMIN'])
   );

 drop policy if exists memberships_manage_admin
   on public.workspace_memberships;

 drop policy if exists memberships_insert_admin
   on public.workspace_memberships;
 create policy memberships_insert_admin
   on public.workspace_memberships
   for insert to authenticated
   with check (app.has_workspace_role(workspace_id, array['OWNER', 'ADMIN']));

 drop policy if exists memberships_update_admin
   on public.workspace_memberships;
 create policy memberships_update_admin
   on public.workspace_memberships
   for update to authenticated
   using (app.has_workspace_role(workspace_id, array['OWNER', 'ADMIN']))
   with check (app.has_workspace_role(workspace_id, array['OWNER', 'ADMIN']));

 drop policy if exists memberships_delete_admin
   on public.workspace_memberships;
 create policy memberships_delete_admin
   on public.workspace_memberships
   for delete to authenticated
   using (app.has_workspace_role(workspace_id, array['OWNER', 'ADMIN']));
