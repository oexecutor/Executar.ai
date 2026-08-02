-- RLS
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.sprints enable row level security;
alter table public.tasks enable row level security;
alter table public.task_steps enable row level security;
alter table public.evidence enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.action_logs enable row level security;
alter table public.recycle_submissions enable row level security;

-- Policies are recreated to keep migration deterministic.
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated using ((select auth.uid())=id);
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);

do $$ declare tbl text; begin
  foreach tbl in array array['projects','sprints','tasks','task_steps','evidence','qr_tokens','recycle_submissions'] loop
    execute format('drop policy if exists %I_member_select on public.%I',tbl,tbl);
    execute format('create policy %I_member_select on public.%I for select to authenticated using (app.is_active_workspace_member(workspace_id))',tbl,tbl);
    execute format('drop policy if exists %I_editor_insert on public.%I',tbl,tbl);
    execute format('create policy %I_editor_insert on public.%I for insert to authenticated with check (app.has_workspace_role(workspace_id,array[''OWNER'',''ADMIN'',''EDITOR'']))',tbl,tbl);
    execute format('drop policy if exists %I_editor_update on public.%I',tbl,tbl);
    execute format('create policy %I_editor_update on public.%I for update to authenticated using (app.has_workspace_role(workspace_id,array[''OWNER'',''ADMIN'',''EDITOR''])) with check (app.has_workspace_role(workspace_id,array[''OWNER'',''ADMIN'',''EDITOR'']))',tbl,tbl);
    execute format('drop policy if exists %I_admin_delete on public.%I',tbl,tbl);
    execute format('create policy %I_admin_delete on public.%I for delete to authenticated using (app.has_workspace_role(workspace_id,array[''OWNER'',''ADMIN'']))',tbl,tbl);
  end loop;
end $$;

drop policy if exists action_logs_member_select on public.action_logs;
create policy action_logs_member_select on public.action_logs for select to authenticated using (app.is_active_workspace_member(workspace_id));

-- Explicit Data API grants (new projects may not auto-expose tables).
grant select on public.workspaces,public.workspace_memberships,public.profiles,public.projects,public.sprints,public.tasks,public.task_steps,public.evidence,public.qr_tokens,public.action_logs,public.recycle_submissions to authenticated;
grant insert,update,delete on public.profiles,public.projects,public.sprints,public.tasks,public.task_steps,public.evidence,public.qr_tokens,public.recycle_submissions to authenticated;
revoke all on public.projects,public.sprints,public.tasks,public.task_steps,public.evidence,public.qr_tokens,public.action_logs,public.recycle_submissions from anon;
