-- Issue #23 E4 — P0 semantic QR Router.
-- Expand-only migration: stable opaque tokens, normalized semantic actions and
-- privacy-minimal access evidence. Provider destinations are never persisted
-- in the printed token or in the route registry.

select pg_advisory_xact_lock(hashtext('executa-ai:editorial-qr:v1'));

-- statement-breakpoint
create table if not exists public.editorial_qr_routes (
  workspace_id text not null,
  environment text not null check (environment in ('production', 'preview')),
  publication_id text not null,
  action text not null check (action in ('CREATE', 'PREVIEW', 'APPROVE', 'ANALYTICS')),
  token text not null primary key check (token ~ '^qr_[A-Za-z0-9_-]{24}$'),
  status text not null check (status in ('ACTIVE', 'REVOKED')),
  access_policy text not null check (
    access_policy in ('PUBLIC_REDIRECT', 'AUTHENTICATED_CONTEXT')
  ),
  issued_at timestamptz not null,
  issued_by text not null check (char_length(issued_by) between 1 and 300),
  updated_at timestamptz not null,
  unique (workspace_id, environment, publication_id, action),
  foreign key (workspace_id, environment, publication_id)
    references public.editorial_publications (workspace_id, environment, id)
    on delete cascade,
  check (updated_at >= issued_at)
);

-- statement-breakpoint
create index if not exists editorial_qr_routes_publication_idx
  on public.editorial_qr_routes (
    workspace_id, environment, publication_id, action
  );

-- statement-breakpoint
create table if not exists public.editorial_qr_access_events (
  event_id text primary key check (event_id ~ '^qre_[A-Za-z0-9-]+$'),
  route_token text not null
    references public.editorial_qr_routes (token)
    on delete cascade,
  occurred_at timestamptz not null,
  outcome text not null check (
    outcome in ('REDIRECTED', 'SAFE_FALLBACK', 'REVOKED')
  )
);

-- statement-breakpoint
create index if not exists editorial_qr_access_timeline_idx
  on public.editorial_qr_access_events (route_token, occurred_at desc);

-- statement-breakpoint
alter table public.editorial_events
  drop constraint if exists editorial_events_event_type_check;

-- statement-breakpoint
alter table public.editorial_events
  add constraint editorial_events_event_type_check check (
    event_type in (
      'CREATED', 'CONTENT_UPDATED', 'STATUS_CHANGED', 'ADAPTER_STARTED',
      'ADAPTER_COMPLETED', 'ADAPTER_FAILED', 'GATE_COMPLETED',
      'PREVIEW_ATTACHED', 'REVIEW_RECORDED', 'PUBLISHED',
      'QR_ISSUED', 'QR_ISSUE_FAILED'
    )
  );

-- statement-breakpoint
do $permissions$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.editorial_qr_routes from anon';
    execute 'revoke all on public.editorial_qr_access_events from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.editorial_qr_routes from authenticated';
    execute 'revoke all on public.editorial_qr_access_events from authenticated';
  end if;
end;
$permissions$;

-- statement-breakpoint
insert into public.app_schema_migrations (migration_id, checksum, details)
values (
  '202607280002_editorial_qr',
  'runtime-verifies-file-sha256',
  jsonb_build_object(
    'issue', 23,
    'phase', 'E4',
    'priority', 'P0',
    'stable_tokens', true,
    'stores_destination_urls', false,
    'stores_ip_or_user_agent', false
  )
)
on conflict (migration_id) do update
  set details = excluded.details,
      applied_at = now();
