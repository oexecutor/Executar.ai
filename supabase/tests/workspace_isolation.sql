begin;

select plan(15);

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
select ok(
  to_regprocedure('app.ensure_personal_workspace(uuid,text,jsonb)') is not null,
  'idempotent personal workspace provisioning exists'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created_create_workspace'
      and not tgisinternal
  ),
  'new auth users are connected to the provisioning trigger'
);

-- Use the same path as a real signup: inserting auth.users must invoke the
-- trigger and create one personal workspace plus one active OWNER membership.
insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'owner-a@example.test',
    '{"full_name":"Owner A"}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'owner-b@example.test',
    '{"full_name":"Owner B"}'::jsonb
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'owner-c@example.test',
    '{"full_name":"Owner C"}'::jsonb
  );

-- A replay must recover the same membership rather than create a duplicate.
do $$
begin
  perform app.ensure_personal_workspace(
    '10000000-0000-0000-0000-000000000003',
    'owner-c@example.test',
    '{"full_name":"Owner C"}'::jsonb
  );
  perform set_config(
    'test.workspace_a',
    (
      select workspace_id::text
      from public.workspace_memberships
      where user_id = '10000000-0000-0000-0000-000000000001'
        and status = 'ACTIVE'
      limit 1
    ),
    true
  );
  perform set_config(
    'test.workspace_b',
    (
      select workspace_id::text
      from public.workspace_memberships
      where user_id = '10000000-0000-0000-0000-000000000002'
        and status = 'ACTIVE'
      limit 1
    ),
    true
  );
end;
$$;

select is(
  (
    select count(*)
    from public.workspace_memberships
    where user_id = '10000000-0000-0000-0000-000000000003'
      and status = 'ACTIVE'
  ),
  1::bigint,
  'a new auth user receives exactly one active workspace membership'
);
select is(
  (
    select role
    from public.workspace_memberships
    where user_id = '10000000-0000-0000-0000-000000000003'
      and status = 'ACTIVE'
  ),
  'OWNER'::text,
  'the personal workspace membership grants OWNER role'
);

insert into public.kv_store (workspace_id, namespace, key, value)
values
  (current_setting('test.workspace_a')::uuid, 'test', 'project/a', '{"workspace":"A"}'),
  (current_setting('test.workspace_b')::uuid, 'test', 'project/b', '{"workspace":"B"}');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select results_eq(
  $$ select slug from public.workspaces order by slug $$,
  $$ values ('owner-a-10000000'::text) $$,
  'a member sees only their workspace'
);

select results_eq(
  $$
    select workspace.slug
    from public.workspace_memberships as membership
    join public.workspaces as workspace on workspace.id = membership.workspace_id
    order by workspace.slug
  $$,
  $$ values ('owner-a-10000000'::text) $$,
  'a member cannot enumerate memberships from another workspace'
);

select results_eq(
  $$ select value ->> 'workspace' from public.kv_store order by key $$,
  $$ values ('A'::text) $$,
  'RLS hides state from another workspace'
);

select lives_ok(
  format(
    'insert into public.kv_store (workspace_id, namespace, key, value) values (%L::uuid, %L, %L, %L::jsonb)',
    current_setting('test.workspace_a'),
    'test',
    'project/a2',
    '{}'
  ),
  'an owner can write inside their workspace'
);

select throws_ok(
  format(
    'insert into public.kv_store (workspace_id, namespace, key, value) values (%L::uuid, %L, %L, %L::jsonb)',
    current_setting('test.workspace_b'),
    'test',
    'project/intrusion',
    '{}'
  ),
  '42501',
  'new row violates row-level security policy for table "kv_store"',
  'RLS rejects a write into another workspace'
);

select throws_ok(
  format(
    'delete from public.workspace_memberships where workspace_id = %L::uuid and user_id = %L::uuid',
    current_setting('test.workspace_a'),
    '10000000-0000-0000-0000-000000000001'
  ),
  'P0001',
  'a workspace must retain at least one active OWNER',
  'the final active owner cannot be removed'
);

select * from finish();
rollback;
