-- EXECUTA.AI — multi-user authentication hardening
--
-- This migration is additive and idempotent. It closes three launch gaps:
-- 1. existing auth.users created before the original trigger receive a workspace;
-- 2. retries/orphaned workspaces do not create duplicate personal workspaces;
-- 3. the final active OWNER of a workspace cannot be removed or demoted.

create or replace function app.ensure_personal_workspace(
  target_user_id uuid,
  target_email text,
  target_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  personal_workspace_id uuid;
  display_name text;
  workspace_slug text;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  -- A user may legitimately belong to several workspaces. If at least one
  -- active membership already exists, onboarding is complete and must not
  -- create another personal workspace during a retry or migration replay.
  select membership.workspace_id
    into personal_workspace_id
  from public.workspace_memberships as membership
  where membership.user_id = target_user_id
    and membership.status = 'ACTIVE'
  order by
    case membership.role when 'OWNER' then 0 else 1 end,
    membership.created_at asc
  limit 1;

  if personal_workspace_id is not null then
    return personal_workspace_id;
  end if;

  display_name := coalesce(
    nullif(trim(target_metadata ->> 'full_name'), ''),
    nullif(trim(target_metadata ->> 'name'), ''),
    nullif(split_part(coalesce(target_email, ''), '@', 1), ''),
    'Meu workspace'
  );

  workspace_slug := lower(regexp_replace(display_name, '[^a-zA-Z0-9]+', '-', 'g'));
  workspace_slug := trim(both '-' from workspace_slug);
  if char_length(workspace_slug) < 3 then
    workspace_slug := 'workspace';
  end if;
  workspace_slug := left(workspace_slug, 52)
    || '-'
    || substr(replace(target_user_id::text, '-', ''), 1, 8);

  -- The deterministic slug lets a retry recover an orphaned workspace that
  -- was created before its membership row, instead of creating a duplicate.
  insert into public.workspaces as workspace (name, slug, status)
  values (display_name, workspace_slug, 'ACTIVE')
  on conflict (slug) do update
    set name = case
      when char_length(trim(workspace.name)) = 0 then excluded.name
      else workspace.name
    end,
    status = case
      when workspace.status = 'ARCHIVED' then workspace.status
      else 'ACTIVE'
    end
  returning workspace.id into personal_workspace_id;

  insert into public.workspace_memberships as membership (
    workspace_id,
    user_id,
    role,
    status,
    updated_at
  )
  values (
    personal_workspace_id,
    target_user_id,
    'OWNER',
    'ACTIVE',
    now()
  )
  on conflict (workspace_id, user_id) do update
    set role = 'OWNER',
        status = 'ACTIVE',
        updated_at = now();

  return personal_workspace_id;
end;
$$;

create or replace function app.create_personal_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.ensure_personal_workspace(
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data, '{}'::jsonb)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_workspace on auth.users;
create trigger on_auth_user_created_create_workspace
  after insert on auth.users
  for each row execute function app.create_personal_workspace();

-- Reconcile accounts created before the trigger existed, or accounts left
-- without a membership by an interrupted historical provisioning attempt.
do $$
declare
  account record;
begin
  for account in
    select users.id, users.email, users.raw_user_meta_data
    from auth.users as users
    where not exists (
      select 1
      from public.workspace_memberships as membership
      where membership.user_id = users.id
        and membership.status = 'ACTIVE'
    )
  loop
    perform app.ensure_personal_workspace(
      account.id,
      account.email,
      coalesce(account.raw_user_meta_data, '{}'::jsonb)
    );
  end loop;
end;
$$;

create or replace function app.guard_workspace_owner_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  removing_active_owner boolean;
begin
  if tg_op = 'UPDATE'
    and (new.workspace_id <> old.workspace_id or new.user_id <> old.user_id)
  then
    raise exception 'workspace_id and user_id are immutable for a membership';
  end if;

  removing_active_owner :=
    old.role = 'OWNER'
    and old.status = 'ACTIVE'
    and (
      tg_op = 'DELETE'
      or new.role <> 'OWNER'
      or new.status <> 'ACTIVE'
    );

  if removing_active_owner and not exists (
    select 1
    from public.workspace_memberships as other_owner
    where other_owner.workspace_id = old.workspace_id
      and other_owner.user_id <> old.user_id
      and other_owner.role = 'OWNER'
      and other_owner.status = 'ACTIVE'
  ) then
    raise exception 'a workspace must retain at least one active OWNER';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists workspace_memberships_guard_owner on public.workspace_memberships;
create trigger workspace_memberships_guard_owner
  before update or delete on public.workspace_memberships
  for each row execute function app.guard_workspace_owner_integrity();

-- Trigger functions are internal implementation details. They do not need to
-- be callable through PostgREST by anon or authenticated clients.
revoke all on function app.ensure_personal_workspace(uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function app.create_personal_workspace()
  from public, anon, authenticated;
revoke all on function app.guard_workspace_owner_integrity()
  from public, anon, authenticated;

comment on function app.ensure_personal_workspace(uuid, text, jsonb) is
  'Idempotently provisions or recovers the first active workspace membership for an auth user.';
comment on function app.guard_workspace_owner_integrity() is
  'Prevents membership identity mutation and deletion/demotion of the final active workspace owner.';
