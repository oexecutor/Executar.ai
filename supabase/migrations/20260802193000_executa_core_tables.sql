create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'EDITOR' check (role in ('OWNER','ADMIN','EDITOR','VIEWER')),
  status text not null default 'ACTIVE' check (status in ('INVITED','ACTIVE','SUSPENDED','REVOKED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create or replace function app.is_active_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = 'public','pg_temp' as $$
  select exists (
    select 1 from public.workspace_memberships membership
    where membership.workspace_id = target_workspace
      and membership.user_id = (select auth.uid())
      and membership.status = 'ACTIVE'
  );
$$;

create or replace function app.has_workspace_role(target_workspace uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = 'public','pg_temp' as $$
  select exists (
    select 1 from public.workspace_memberships membership
    where membership.workspace_id = target_workspace
      and membership.user_id = (select auth.uid())
      and membership.status = 'ACTIVE'
      and membership.role = any(allowed_roles)
  );
$$;

revoke all on function app.is_active_workspace_member(uuid) from public;
revoke all on function app.has_workspace_role(uuid,text[]) from public;
grant execute on function app.is_active_workspace_member(uuid) to authenticated;
grant execute on function app.has_workspace_role(uuid,text[]) to authenticated;

create or replace function app.ensure_personal_workspace(target_user_id uuid, target_email text, target_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  personal_workspace_id uuid;
  display_name text;
  workspace_slug text;
begin
  select membership.workspace_id into personal_workspace_id
  from public.workspace_memberships membership
  join public.workspaces workspace on workspace.id = membership.workspace_id
  where membership.user_id = target_user_id and membership.status = 'ACTIVE' and workspace.status = 'ACTIVE'
  order by case membership.role when 'OWNER' then 0 else 1 end, membership.created_at asc limit 1;
  if personal_workspace_id is not null then return personal_workspace_id; end if;
  display_name := coalesce(nullif(trim(target_metadata->>'full_name'),''), nullif(trim(target_metadata->>'name'),''), nullif(split_part(coalesce(target_email,''),'@',1),''), 'Meu workspace');
  workspace_slug := trim(both '-' from lower(regexp_replace(display_name,'[^a-zA-Z0-9]+','-','g')));
  if char_length(workspace_slug) < 3 then workspace_slug := 'workspace'; end if;
  workspace_slug := left(workspace_slug,52) || '-' || substr(replace(target_user_id::text,'-',''),1,8);
  insert into public.workspaces(name,slug,status) values(display_name,workspace_slug,'ACTIVE')
  on conflict(slug) do update set status='ACTIVE', updated_at=now() returning id into personal_workspace_id;
  insert into public.workspace_memberships(workspace_id,user_id,role,status)
  values(personal_workspace_id,target_user_id,'OWNER','ACTIVE')
  on conflict(workspace_id,user_id) do update set role='OWNER',status='ACTIVE',updated_at=now();
  return personal_workspace_id;
end;
$$;

create or replace function app.create_personal_workspace()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app.ensure_personal_workspace(new.id,new.email,coalesce(new.raw_user_meta_data,'{}'::jsonb));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_workspace on auth.users;
drop trigger if exists on_auth_user_created_personal_workspace on auth.users;
create trigger on_auth_user_created_personal_workspace after insert on auth.users for each row execute procedure app.create_personal_workspace();

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null,
  name text not null check (char_length(name) between 3 and 120),
  description text,
  status text not null default 'ACTIVE' check (status in ('PLANNING','ACTIVE','PAUSED','COMPLETED','ARCHIVED')),
  current_phase text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, code)
);

create table if not exists public.sprints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  starts_on date,
  ends_on date,
  status text not null default 'PLANNED' check (status in ('PLANNED','ACTIVE','CLOSED','CANCELLED')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  sprint_id uuid references public.sprints(id) on delete set null,
  reference text not null,
  title text not null check (char_length(title) between 1 and 180),
  description text,
  status text not null default 'READY' check (status in ('PENDING','READY','IN_PROGRESS','BLOCKED','DONE','CANCELLED')),
  priority integer not null default 3 check (priority between 1 and 5),
  position integer not null default 1 check (position > 0),
  due_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(workspace_id, reference)
);

create table if not exists public.task_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  position integer not null check (position between 1 and 3),
  title text not null check (char_length(title) between 1 and 180),
  is_done boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(task_id, position)
);

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  kind text not null check (kind in ('NOTE','PHOTO','FILE','LINK','QR_RECYCLE')),
  title text not null check (char_length(title) between 1 and 180),
  content text,
  storage_path text,
  mime_type text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (content is not null or storage_path is not null)
);

create table if not exists public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  token text not null unique check (token ~ '^qr_[A-Za-z0-9_-]{24,96}$'),
  intent text not null check (intent in ('START','CONTINUE','STATUS','COMPLETE','RECYCLE')),
  target_status text check (target_status is null or target_status in ('PENDING','READY','IN_PROGRESS','BLOCKED','DONE','CANCELLED')),
  requires_confirmation boolean not null default true,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','USED','REVOKED','EXPIRED')),
  expires_at timestamptz,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.action_logs (
  audit_id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  token_id uuid references public.qr_tokens(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action_type text not null,
  intent text,
  from_state jsonb,
  to_state jsonb,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists action_logs_workspace_idempotency_uidx on public.action_logs(workspace_id,idempotency_key) where idempotency_key is not null;

create table if not exists public.recycle_submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  sprint_id uuid references public.sprints(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  status text not null default 'RECEIVED' check (status in ('RECEIVED','REVIEW_REQUIRED','RECONCILED','DISCARDED')),
  storage_path text,
  structured_input jsonb not null default '{}'::jsonb,
  consent_at timestamptz not null,
  retention_until timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_workspace_status_idx on public.projects(workspace_id,status,updated_at desc);
create index if not exists tasks_project_position_idx on public.tasks(project_id,status,position,created_at);
create index if not exists task_steps_task_position_idx on public.task_steps(task_id,position);
create index if not exists evidence_task_created_idx on public.evidence(task_id,created_at desc);
create index if not exists qr_tokens_task_status_idx on public.qr_tokens(task_id,status);
create index if not exists action_logs_workspace_created_idx on public.action_logs(workspace_id,created_at desc);

create index if not exists action_logs_actor_user_idx on public.action_logs(actor_user_id);
create index if not exists action_logs_project_idx on public.action_logs(project_id);
create index if not exists action_logs_task_idx on public.action_logs(task_id);
create index if not exists action_logs_token_idx on public.action_logs(token_id);
create index if not exists evidence_created_by_idx on public.evidence(created_by);
create index if not exists evidence_project_idx on public.evidence(project_id);
create index if not exists evidence_workspace_idx on public.evidence(workspace_id);
create index if not exists projects_created_by_idx on public.projects(created_by);
create index if not exists projects_updated_by_idx on public.projects(updated_by);
create index if not exists qr_tokens_created_by_idx on public.qr_tokens(created_by);
create index if not exists qr_tokens_project_idx on public.qr_tokens(project_id);
create index if not exists qr_tokens_used_by_idx on public.qr_tokens(used_by);
create index if not exists qr_tokens_workspace_idx on public.qr_tokens(workspace_id);
create index if not exists recycle_created_by_idx on public.recycle_submissions(created_by);
create index if not exists recycle_project_idx on public.recycle_submissions(project_id);
create index if not exists recycle_sprint_idx on public.recycle_submissions(sprint_id);
create index if not exists recycle_task_idx on public.recycle_submissions(task_id);
create index if not exists recycle_workspace_idx on public.recycle_submissions(workspace_id);
create index if not exists sprints_created_by_idx on public.sprints(created_by);
create index if not exists sprints_project_idx on public.sprints(project_id);
create index if not exists sprints_workspace_idx on public.sprints(workspace_id);
create index if not exists task_steps_completed_by_idx on public.task_steps(completed_by);
create index if not exists task_steps_workspace_idx on public.task_steps(workspace_id);
create index if not exists tasks_created_by_idx on public.tasks(created_by);
create index if not exists tasks_sprint_idx on public.tasks(sprint_id);
create index if not exists tasks_updated_by_idx on public.tasks(updated_by);
