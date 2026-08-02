grant usage on schema app to authenticated, service_role;

create or replace function app.resolve_qr_token_internal(p_token text)
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

create or replace function app.create_project_with_first_task_internal(
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

create or replace function app.complete_task_step_internal(p_task_id uuid,p_position integer,p_idempotency_key text)
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

create or replace function app.confirm_qr_action_internal(p_token text,p_idempotency_key text)
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


revoke all on function app.resolve_qr_token_internal(text) from public, anon;
revoke all on function app.create_project_with_first_task_internal(text,text,text,text[]) from public, anon;
revoke all on function app.complete_task_step_internal(uuid,integer,text) from public, anon;
revoke all on function app.confirm_qr_action_internal(text,text) from public, anon;

grant execute on function app.resolve_qr_token_internal(text) to authenticated, service_role;
grant execute on function app.create_project_with_first_task_internal(text,text,text,text[]) to authenticated, service_role;
grant execute on function app.complete_task_step_internal(uuid,integer,text) to authenticated, service_role;
grant execute on function app.confirm_qr_action_internal(text,text) to authenticated, service_role;

create or replace function public.resolve_qr_token(p_token text)
returns table(
  token text, workspace_id uuid, project_id uuid, task_id uuid, task_reference text,
  task_title text, current_status text, intent text, target_status text,
  requires_confirmation boolean, status text, expires_at timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select * from app.resolve_qr_token_internal(p_token);
$$;

create or replace function public.create_project_with_first_task(
  p_name text, p_description text, p_first_task_title text, p_steps text[]
) returns jsonb language sql volatile security invoker set search_path = '' as $$
  select app.create_project_with_first_task_internal(p_name,p_description,p_first_task_title,p_steps);
$$;

create or replace function public.complete_task_step(p_task_id uuid,p_position integer,p_idempotency_key text)
returns jsonb language sql volatile security invoker set search_path = '' as $$
  select app.complete_task_step_internal(p_task_id,p_position,p_idempotency_key);
$$;

create or replace function public.confirm_qr_action(p_token text,p_idempotency_key text)
returns jsonb language sql volatile security invoker set search_path = '' as $$
  select app.confirm_qr_action_internal(p_token,p_idempotency_key);
$$;

revoke execute on function public.resolve_qr_token(text) from public, anon;
revoke execute on function public.create_project_with_first_task(text,text,text,text[]) from public, anon;
revoke execute on function public.complete_task_step(uuid,integer,text) from public, anon;
revoke execute on function public.confirm_qr_action(text,text) from public, anon;

grant execute on function public.resolve_qr_token(text) to authenticated, service_role;
grant execute on function public.create_project_with_first_task(text,text,text,text[]) to authenticated, service_role;
grant execute on function public.complete_task_step(uuid,integer,text) to authenticated, service_role;
grant execute on function public.confirm_qr_action(text,text) to authenticated, service_role;
