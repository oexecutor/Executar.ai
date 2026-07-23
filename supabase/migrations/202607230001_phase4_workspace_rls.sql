create schema if not exists app;
create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.kv_store') is not null
    and not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'kv_store'
        and column_name = 'workspace_id'
    )
  then
    if to_regclass('public.legacy_kv_store') is not null then
      raise exception 'Both kv_store legacy schema and legacy_kv_store exist; reconcile them before Phase 4 migration';
    end if;
    alter table public.kv_store rename to legacy_kv_store;
  end if;
end;
$$;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'EDITOR' check (role in ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER')),
  status text not null default 'ACTIVE' check (status in ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.kv_store (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  namespace text not null,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, namespace, key)
);

create table if not exists public.oauth_kv_store (
  namespace text not null,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (namespace, key)
);

do $$
begin
  if to_regclass('public.legacy_kv_store') is not null then
    insert into public.oauth_kv_store (namespace, key, value, updated_at)
    select namespace, key, value, updated_at
    from public.legacy_kv_store
    where namespace like '%oauth%'
    on conflict (namespace, key) do update
      set value = excluded.value, updated_at = excluded.updated_at;
  end if;
end;
$$;

create index if not exists workspace_memberships_user_idx
  on public.workspace_memberships (user_id, status);
create index if not exists kv_store_prefix_idx
  on public.kv_store (workspace_id, namespace, key text_pattern_ops);

create or replace function app.is_active_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_memberships membership
    where membership.workspace_id = target_workspace
      and membership.user_id = auth.uid()
      and membership.status = 'ACTIVE'
  );
$$;

create or replace function app.has_workspace_role(target_workspace uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_memberships membership
    where membership.workspace_id = target_workspace
      and membership.user_id = auth.uid()
      and membership.status = 'ACTIVE'
      and membership.role = any(allowed_roles)
  );
$$;

revoke all on function app.is_active_workspace_member(uuid) from public;
revoke all on function app.has_workspace_role(uuid, text[]) from public;
revoke all on schema app from public;
grant usage on schema app to authenticated;
grant execute on function app.is_active_workspace_member(uuid) to authenticated;
grant execute on function app.has_workspace_role(uuid, text[]) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.kv_store enable row level security;
alter table public.oauth_kv_store enable row level security;

drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member on public.workspaces
  for select to authenticated
  using (app.is_active_workspace_member(id));

drop policy if exists memberships_select_self_or_admin on public.workspace_memberships;
create policy memberships_select_self_or_admin on public.workspace_memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or app.has_workspace_role(workspace_id, array['OWNER', 'ADMIN'])
  );

drop policy if exists memberships_manage_admin on public.workspace_memberships;
create policy memberships_manage_admin on public.workspace_memberships
  for all to authenticated
  using (app.has_workspace_role(workspace_id, array['OWNER', 'ADMIN']))
  with check (app.has_workspace_role(workspace_id, array['OWNER', 'ADMIN']));

drop policy if exists kv_store_select_member on public.kv_store;
create policy kv_store_select_member on public.kv_store
  for select to authenticated
  using (app.is_active_workspace_member(workspace_id));

drop policy if exists kv_store_insert_editor on public.kv_store;
create policy kv_store_insert_editor on public.kv_store
  for insert to authenticated
  with check (app.has_workspace_role(workspace_id, array['OWNER', 'ADMIN', 'EDITOR']));

drop policy if exists kv_store_update_editor on public.kv_store;
create policy kv_store_update_editor on public.kv_store
  for update to authenticated
  using (app.has_workspace_role(workspace_id, array['OWNER', 'ADMIN', 'EDITOR']))
  with check (app.has_workspace_role(workspace_id, array['OWNER', 'ADMIN', 'EDITOR']));

drop policy if exists kv_store_delete_editor on public.kv_store;
create policy kv_store_delete_editor on public.kv_store
  for delete to authenticated
  using (app.has_workspace_role(workspace_id, array['OWNER', 'ADMIN', 'EDITOR']));

grant usage on schema public to authenticated;
grant select on public.workspaces, public.workspace_memberships to authenticated;
grant select, insert, update, delete on public.kv_store to authenticated;
revoke all on public.oauth_kv_store from anon, authenticated;

create or replace function app.create_personal_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  workspace_id uuid;
  display_name text;
  workspace_slug text;
begin
  display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Meu workspace'
  );
  workspace_slug := lower(regexp_replace(display_name, '[^a-zA-Z0-9]+', '-', 'g'));
  workspace_slug := trim(both '-' from workspace_slug);
  if char_length(workspace_slug) < 3 then workspace_slug := 'workspace'; end if;
  workspace_slug := left(workspace_slug, 52) || '-' || substr(replace(new.id::text, '-', ''), 1, 8);

  insert into public.workspaces (name, slug)
  values (display_name, workspace_slug)
  returning id into workspace_id;

  insert into public.workspace_memberships (workspace_id, user_id, role, status)
  values (workspace_id, new.id, 'OWNER', 'ACTIVE');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_workspace on auth.users;
create trigger on_auth_user_created_create_workspace
  after insert on auth.users
  for each row execute procedure app.create_personal_workspace();
