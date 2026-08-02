create or replace function app.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function app.audit_row_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  row_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) - 'content' - 'structured_input' end;
  row_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) - 'content' - 'structured_input' end;
  ws uuid := coalesce((row_new->>'workspace_id')::uuid,(row_old->>'workspace_id')::uuid);
  prj uuid;
  tsk uuid;
begin
  prj := case when tg_table_name='projects' then coalesce((row_new->>'id')::uuid,(row_old->>'id')::uuid) else coalesce(nullif(row_new->>'project_id','')::uuid,nullif(row_old->>'project_id','')::uuid) end;
  tsk := case when tg_table_name='tasks' then coalesce((row_new->>'id')::uuid,(row_old->>'id')::uuid) else coalesce(nullif(row_new->>'task_id','')::uuid,nullif(row_old->>'task_id','')::uuid) end;
  insert into public.action_logs(workspace_id,project_id,task_id,actor_user_id,action_type,from_state,to_state,metadata)
  values(ws,prj,tsk,(select auth.uid()),upper(tg_op)||'_'||upper(tg_table_name),row_old,row_new,jsonb_build_object('table',tg_table_name));
  return case when tg_op='DELETE' then old else new end;
end;
$$;

revoke all on function app.audit_row_change() from public;

-- updated_at triggers
do $$
declare tbl text;
begin
  foreach tbl in array array['workspaces','workspace_memberships','profiles','projects','sprints','tasks','task_steps','recycle_submissions'] loop
    execute format('drop trigger if exists set_updated_at on public.%I',tbl);
    execute format('create trigger set_updated_at before update on public.%I for each row execute procedure app.set_updated_at()',tbl);
  end loop;
end $$;

-- audit triggers
DO $$
declare tbl text;
begin
  foreach tbl in array array['projects','sprints','tasks','task_steps','evidence','qr_tokens','recycle_submissions'] loop
    execute format('drop trigger if exists audit_write on public.%I',tbl);
    execute format('create trigger audit_write after insert or update or delete on public.%I for each row execute procedure app.audit_row_change()',tbl);
  end loop;
end $$;

create or replace function public.resolve_qr_token(p_token text)
returns table(
  token text, workspace_id uuid, project_id uuid, task_id uuid, task_reference text,
  task_title text, current_status text, intent text, target_status text,
  requires_confirmation boolean, status text, expires_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select q.token,q.workspace_id,q.project_id,q.task_id,t.reference,t.title,t.status,q.intent,q.target_status,q.requires_confirmation,
    case when q.status='ACTIVE' and q.expires_at is not null and q.expires_at <= now() then 'EXPIRED' else q.status end,
    q.expires_at
  from public.qr_tokens q left join public.tasks t on t.id=q.task_id where q.token=p_token limit 1;
$$;
revoke all on function public.resolve_qr_token(text) from public;
revoke execute on function public.resolve_qr_token(text) from anon;
grant execute on function public.resolve_qr_token(text) to authenticated, service_role;

create or replace function public.create_project_with_first_task(
  p_name text, p_description text, p_first_task_title text, p_steps text[]
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid()); ws uuid; project_id uuid; task_id uuid; project_code text; task_reference text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if array_length(p_steps,1) <> 3 then raise exception 'exactly_three_steps_required'; end if;
  select workspace_id into ws from public.workspace_memberships where user_id=uid and status='ACTIVE' order by case role when 'OWNER' then 0 else 1 end, created_at limit 1;
  if ws is null then ws := app.ensure_personal_workspace(uid,null,'{}'::jsonb); end if;
  if not app.has_workspace_role(ws,array['OWNER','ADMIN','EDITOR']) then raise exception 'insufficient_role'; end if;
  project_code := 'PRJ-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  task_reference := 'TSK-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.projects(workspace_id,code,name,description,status,created_by,updated_by) values(ws,project_code,trim(p_name),nullif(trim(p_description),''),'ACTIVE',uid,uid) returning id into project_id;
  insert into public.tasks(workspace_id,project_id,reference,title,status,priority,position,created_by,updated_by) values(ws,project_id,task_reference,trim(p_first_task_title),'READY',1,1,uid,uid) returning id into task_id;
  insert into public.task_steps(workspace_id,task_id,position,title) values(ws,task_id,1,trim(p_steps[1])),(ws,task_id,2,trim(p_steps[2])),(ws,task_id,3,trim(p_steps[3]));
  return jsonb_build_object('projectId',project_id,'taskId',task_id,'projectCode',project_code,'taskReference',task_reference);
end;
$$;
revoke all on function public.create_project_with_first_task(text,text,text,text[]) from public;
revoke execute on function public.create_project_with_first_task(text,text,text,text[]) from anon;
grant execute on function public.create_project_with_first_task(text,text,text,text[]) to authenticated, service_role;

create or replace function public.get_current_position(p_project_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare prj record; current_task record; steps jsonb; total_count int; done_count int;
begin
  select * into prj from public.projects where id=p_project_id;
  if prj.id is null then raise exception 'project_not_found'; end if;
  select count(*),count(*) filter(where status='DONE') into total_count,done_count from public.tasks where project_id=p_project_id and status<>'CANCELLED';
  select * into current_task from public.tasks where project_id=p_project_id and status not in ('DONE','CANCELLED') order by priority asc,position asc,created_at asc limit 1;
  if current_task.id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id',id,'taskId',task_id,'position',position,'title',title,'isDone',is_done,'completedAt',completed_at) order by position),'[]'::jsonb) into steps from public.task_steps where task_id=current_task.id;
  else steps := '[]'::jsonb; end if;
  return jsonb_build_object(
    'project',jsonb_build_object('id',prj.id,'workspaceId',prj.workspace_id,'code',prj.code,'name',prj.name,'description',prj.description,'status',prj.status,'updatedAt',prj.updated_at),
    'task',case when current_task.id is null then null else jsonb_build_object('id',current_task.id,'projectId',current_task.project_id,'reference',current_task.reference,'title',current_task.title,'description',current_task.description,'status',current_task.status,'priority',current_task.priority,'steps',steps) end,
    'completedTasks',done_count,'totalTasks',total_count,'progressPercent',case when total_count=0 then 0 else round((done_count::numeric/total_count::numeric)*100)::int end
  );
end;
$$;
revoke all on function public.get_current_position(uuid) from public;
revoke execute on function public.get_current_position(uuid) from anon;
grant execute on function public.get_current_position(uuid) to authenticated, service_role;

create or replace function public.complete_task_step(p_task_id uuid,p_position integer,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); t record; already jsonb; remaining int; next_status text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select to_state into already from public.action_logs where idempotency_key=p_idempotency_key and actor_user_id=uid limit 1;
  if already is not null then return already; end if;
  select * into t from public.tasks where id=p_task_id for update;
  if t.id is null then raise exception 'task_not_found'; end if;
  if not app.has_workspace_role(t.workspace_id,array['OWNER','ADMIN','EDITOR']) then raise exception 'insufficient_role'; end if;
  update public.task_steps set is_done=true,completed_at=now(),completed_by=uid,updated_at=now() where task_id=p_task_id and position=p_position;
  if not found then raise exception 'step_not_found'; end if;
  select count(*) into remaining from public.task_steps where task_id=p_task_id and not is_done;
  next_status := case when remaining=0 then 'DONE' else 'IN_PROGRESS' end;
  update public.tasks set status=next_status,updated_by=uid,completed_at=case when remaining=0 then now() else completed_at end where id=p_task_id;
  insert into public.action_logs(workspace_id,project_id,task_id,actor_user_id,action_type,intent,to_state,idempotency_key,metadata)
  values(t.workspace_id,t.project_id,t.id,uid,'STEP_COMPLETED','COMPLETE',jsonb_build_object('status','ok','taskId',t.id,'taskStatus',next_status),p_idempotency_key,jsonb_build_object('position',p_position));
  return jsonb_build_object('status','ok','taskId',t.id,'taskStatus',next_status);
end;
$$;
revoke all on function public.complete_task_step(uuid,integer,text) from public;
revoke execute on function public.complete_task_step(uuid,integer,text) from anon;
grant execute on function public.complete_task_step(uuid,integer,text) to authenticated, service_role;

create or replace function public.confirm_qr_action(p_token text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); q record; t record; existing jsonb; next_status text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select to_state into existing from public.action_logs where idempotency_key=p_idempotency_key and actor_user_id=uid limit 1;
  if existing is not null then return existing; end if;
  select * into q from public.qr_tokens where token=p_token for update;
  if q.id is null then raise exception 'qr_not_found'; end if;
  if q.status<>'ACTIVE' then raise exception 'qr_not_active'; end if;
  if q.expires_at is not null and q.expires_at<=now() then update public.qr_tokens set status='EXPIRED' where id=q.id; raise exception 'qr_expired'; end if;
  if not app.has_workspace_role(q.workspace_id,array['OWNER','ADMIN','EDITOR']) then raise exception 'insufficient_role'; end if;
  if q.task_id is not null then
    select * into t from public.tasks where id=q.task_id for update;
    next_status := coalesce(q.target_status,t.status);
    update public.tasks set status=next_status,updated_by=uid,completed_at=case when next_status='DONE' then now() else completed_at end where id=t.id;
  else next_status := null; end if;
  update public.qr_tokens set status=case when requires_confirmation then 'USED' else status end,used_at=now(),used_by=uid where id=q.id;
  insert into public.action_logs(workspace_id,project_id,task_id,token_id,actor_user_id,action_type,intent,from_state,to_state,idempotency_key)
  values(q.workspace_id,q.project_id,q.task_id,q.id,uid,'QR_ACTION_CONFIRMED',q.intent,case when t.id is null then null else jsonb_build_object('taskStatus',t.status) end,jsonb_build_object('status','ok','taskId',q.task_id,'taskStatus',next_status),p_idempotency_key);
  return jsonb_build_object('status','ok','taskId',q.task_id,'taskStatus',next_status);
end;
$$;
revoke all on function public.confirm_qr_action(text,text) from public;
revoke execute on function public.confirm_qr_action(text,text) from anon;
grant execute on function public.confirm_qr_action(text,text) to authenticated, service_role;
