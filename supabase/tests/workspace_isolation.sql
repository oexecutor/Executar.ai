begin;

select plan(10);

select has_table('public', 'workspaces', 'workspaces exists');
select has_table('public', 'workspace_memberships', 'memberships exists');
select has_table('public', 'kv_store', 'workspace-scoped state exists');
select has_table('public', 'oauth_kv_store', 'server-owned OAuth state is separated');
select policies_are(
  'public',
  'kv_store',
  array[
    'kv_store_delete_editor',
    'kv_store_insert_editor',
    'kv_store_select_member',
    'kv_store_update_editor'
  ],
  'kv_store has explicit member/editor policies'
);

alter table auth.users disable trigger on_auth_user_created_create_workspace;

insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000001', 'owner-a@example.test'),
  ('10000000-0000-0000-0000-000000000002', 'owner-b@example.test');

alter table auth.users enable trigger on_auth_user_created_create_workspace;

insert into public.workspaces (id, name, slug)
values
  ('20000000-0000-0000-0000-000000000001', 'Workspace A', 'workspace-a-test'),
  ('20000000-0000-0000-0000-000000000002', 'Workspace B', 'workspace-b-test');

insert into public.workspace_memberships (workspace_id, user_id, role, status)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'OWNER', 'ACTIVE'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'OWNER', 'ACTIVE');

insert into public.kv_store (workspace_id, namespace, key, value)
values
  ('20000000-0000-0000-0000-000000000001', 'test', 'project/a', '{"workspace":"A"}'),
  ('20000000-0000-0000-0000-000000000002', 'test', 'project/b', '{"workspace":"B"}');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select results_eq(
  $$ select id from public.workspaces order by id $$,
  $$ values ('20000000-0000-0000-0000-000000000001'::uuid) $$,
  'a member sees only their workspace'
);

select results_eq(
  $$ select workspace_id from public.workspace_memberships order by workspace_id $$,
  $$ values ('20000000-0000-0000-0000-000000000001'::uuid) $$,
  'a member cannot enumerate memberships from another workspace'
);

select results_eq(
  $$ select value ->> 'workspace' from public.kv_store order by key $$,
  $$ values ('A'::text) $$,
  'RLS hides state from another workspace'
);

select lives_ok(
  $$ insert into public.kv_store (workspace_id, namespace, key, value)
     values ('20000000-0000-0000-0000-000000000001', 'test', 'project/a2', '{}') $$,
  'an owner can write inside their workspace'
);

select throws_ok(
  $$ insert into public.kv_store (workspace_id, namespace, key, value)
     values ('20000000-0000-0000-0000-000000000002', 'test', 'project/intrusion', '{}') $$,
  '42501',
  'new row violates row-level security policy for table "kv_store"',
  'RLS rejects a write into another workspace'
);

select * from finish();
rollback;
