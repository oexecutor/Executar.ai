-- EXECUTA.AI Editorial V2 relational persistence
-- Expand-only migration: creates the new source of truth, backs up and
-- backfills legacy KV rows, and deliberately leaves the source rows intact.

select pg_advisory_xact_lock(hashtext('executa-ai:editorial-postgres:v1'));

-- statement-breakpoint
create table if not exists public.editorial_publications (
  workspace_id text not null check (char_length(workspace_id) between 1 and 128),
  environment text not null check (environment in ('production', 'preview')),
  id text not null check (id ~ '^PUB-[A-Za-z0-9-]+$'),
  version integer not null check (version > 0),
  status text not null check (
    status in (
      'DRAFT', 'VALIDATING', 'VALIDATION_FAILED', 'READY_FOR_PREVIEW',
      'PREVIEW_BUILDING', 'PREVIEW_FAILED', 'PREVIEW_READY', 'IN_REVIEW',
      'CHANGES_REQUESTED', 'APPROVED', 'PUBLISHING', 'PUBLISH_FAILED',
      'PUBLISHED', 'QR_FAILED', 'ARCHIVED'
    )
  ),
  title text not null check (char_length(title) between 1 and 300),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  author text not null check (char_length(author) between 1 and 200),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (workspace_id, environment, id),
  check (updated_at >= created_at),
  check (document ->> 'id' = id),
  check ((document ->> 'version')::integer = version),
  check (document ->> 'status' = status)
);

-- statement-breakpoint
create index if not exists editorial_publications_workspace_updated_idx
  on public.editorial_publications (workspace_id, environment, updated_at desc);

-- statement-breakpoint
create index if not exists editorial_publications_status_idx
  on public.editorial_publications (workspace_id, environment, status, updated_at desc);

-- statement-breakpoint
create table if not exists public.editorial_events (
  workspace_id text not null,
  environment text not null,
  publication_id text not null,
  event_id text not null check (char_length(event_id) between 1 and 128),
  event_type text not null check (
    event_type in (
      'CREATED', 'CONTENT_UPDATED', 'STATUS_CHANGED', 'PREVIEW_ATTACHED',
      'REVIEW_RECORDED', 'PUBLISHED'
    )
  ),
  occurred_at timestamptz not null,
  actor text not null check (char_length(actor) between 1 and 300),
  event jsonb not null check (jsonb_typeof(event) = 'object'),
  primary key (workspace_id, environment, publication_id, event_id),
  foreign key (workspace_id, environment, publication_id)
    references public.editorial_publications (workspace_id, environment, id)
    on delete cascade,
  check (event ->> 'id' = event_id),
  check (event ->> 'type' = event_type)
);

-- statement-breakpoint
create index if not exists editorial_events_timeline_idx
  on public.editorial_events (workspace_id, environment, publication_id, occurred_at asc);

-- statement-breakpoint
create table if not exists public.editorial_legacy_backup (
  source_table text not null,
  source_namespace text not null,
  source_key text not null,
  workspace_id text not null,
  environment text not null check (environment in ('production', 'preview')),
  value jsonb not null,
  source_updated_at timestamptz,
  backed_up_at timestamptz not null default now(),
  primary key (source_table, source_namespace, source_key)
);

-- statement-breakpoint
create table if not exists public.app_schema_migrations (
  migration_id text primary key,
  checksum text not null,
  details jsonb not null default '{}'::jsonb,
  applied_at timestamptz not null default now()
);

-- statement-breakpoint
do $migration$
declare
  kv_has_workspace_id boolean;
begin
  if to_regclass('public.kv_store') is not null then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'kv_store'
        and column_name = 'workspace_id'
    ) into kv_has_workspace_id;

    if kv_has_workspace_id then
      execute $sql$
        insert into public.editorial_legacy_backup (
          source_table, source_namespace, source_key, workspace_id,
          environment, value, source_updated_at
        )
        select
          'kv_store', namespace, key, workspace_id::text,
          case when namespace like '%production' then 'production' else 'preview' end,
          value, updated_at
        from public.kv_store
        where key like 'editorial/publication/%'
          and jsonb_typeof(value) = 'object'
        on conflict (source_table, source_namespace, source_key) do update
          set value = excluded.value,
              source_updated_at = excluded.source_updated_at,
              backed_up_at = now()
      $sql$;
    else
      execute $sql$
        insert into public.editorial_legacy_backup (
          source_table, source_namespace, source_key, workspace_id,
          environment, value, source_updated_at
        )
        select
          'kv_store',
          namespace,
          key,
          case
            when namespace like '%:executa-vault-%' then split_part(namespace, ':', 1)
            else 'public'
          end,
          case when namespace like '%production' then 'production' else 'preview' end,
          value,
          updated_at
        from public.kv_store
        where key like 'editorial/publication/%'
          and jsonb_typeof(value) = 'object'
        on conflict (source_table, source_namespace, source_key) do update
          set value = excluded.value,
              source_updated_at = excluded.source_updated_at,
              backed_up_at = now()
      $sql$;
    end if;
  end if;

  if to_regclass('public.legacy_kv_store') is not null then
    execute $sql$
      insert into public.editorial_legacy_backup (
        source_table, source_namespace, source_key, workspace_id,
        environment, value, source_updated_at
      )
      select
        'legacy_kv_store',
        namespace,
        key,
        case
          when namespace like '%:executa-vault-%' then split_part(namespace, ':', 1)
          else 'public'
        end,
        case when namespace like '%production' then 'production' else 'preview' end,
        value,
        updated_at
      from public.legacy_kv_store
      where key like 'editorial/publication/%'
        and jsonb_typeof(value) = 'object'
      on conflict (source_table, source_namespace, source_key) do update
        set value = excluded.value,
            source_updated_at = excluded.source_updated_at,
            backed_up_at = now()
    $sql$;
  end if;
end;
$migration$;

-- statement-breakpoint
insert into public.editorial_publications (
  workspace_id, environment, id, version, status, title, slug, author,
  document, created_at, updated_at
)
select
  workspace_id,
  environment,
  value ->> 'id',
  (value ->> 'version')::integer,
  value ->> 'status',
  value #>> '{briefing,title}',
  value #>> '{content,slug}',
  value #>> '{briefing,author}',
  value,
  (value ->> 'created_at')::timestamptz,
  (value ->> 'updated_at')::timestamptz
from public.editorial_legacy_backup
where value ->> 'id' ~ '^PUB-[A-Za-z0-9-]+$'
  and (value ->> 'version') ~ '^[1-9][0-9]*$'
  and value ->> 'status' in (
    'DRAFT', 'VALIDATING', 'VALIDATION_FAILED', 'READY_FOR_PREVIEW',
    'PREVIEW_BUILDING', 'PREVIEW_FAILED', 'PREVIEW_READY', 'IN_REVIEW',
    'CHANGES_REQUESTED', 'APPROVED', 'PUBLISHING', 'PUBLISH_FAILED',
    'PUBLISHED', 'QR_FAILED', 'ARCHIVED'
  )
  and value #>> '{briefing,title}' is not null
  and value #>> '{content,slug}' ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  and value #>> '{briefing,author}' is not null
  and value ->> 'created_at' is not null
  and value ->> 'updated_at' is not null
on conflict (workspace_id, environment, id) do update
  set version = excluded.version,
      status = excluded.status,
      title = excluded.title,
      slug = excluded.slug,
      author = excluded.author,
      document = excluded.document,
      updated_at = excluded.updated_at
where public.editorial_publications.updated_at <= excluded.updated_at;

-- statement-breakpoint
insert into public.editorial_events (
  workspace_id, environment, publication_id, event_id, event_type,
  occurred_at, actor, event
)
select
  publication.workspace_id,
  publication.environment,
  publication.id,
  event ->> 'id',
  event ->> 'type',
  (event ->> 'at')::timestamptz,
  event ->> 'actor',
  event
from public.editorial_publications publication
cross join lateral jsonb_array_elements(publication.document -> 'events') event
where jsonb_typeof(publication.document -> 'events') = 'array'
  and event ->> 'id' is not null
  and event ->> 'type' in (
    'CREATED', 'CONTENT_UPDATED', 'STATUS_CHANGED', 'PREVIEW_ATTACHED',
    'REVIEW_RECORDED', 'PUBLISHED'
  )
  and event ->> 'at' is not null
  and event ->> 'actor' is not null
on conflict (workspace_id, environment, publication_id, event_id) do nothing;

-- statement-breakpoint
do $permissions$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.editorial_publications from anon';
    execute 'revoke all on public.editorial_events from anon';
    execute 'revoke all on public.editorial_legacy_backup from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.editorial_publications from authenticated';
    execute 'revoke all on public.editorial_events from authenticated';
    execute 'revoke all on public.editorial_legacy_backup from authenticated';
  end if;
end;
$permissions$;

-- statement-breakpoint
insert into public.app_schema_migrations (migration_id, checksum, details)
values (
  '202607270001_editorial_postgres',
  'runtime-verifies-file-sha256',
  jsonb_build_object(
    'strategy', 'expand-dual-write',
    'legacy_rows_preserved', true,
    'backup_rows', (select count(*) from public.editorial_legacy_backup),
    'publication_rows', (select count(*) from public.editorial_publications),
    'event_rows', (select count(*) from public.editorial_events)
  )
)
on conflict (migration_id) do update
  set details = excluded.details,
      applied_at = now();
