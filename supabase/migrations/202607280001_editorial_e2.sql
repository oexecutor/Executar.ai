-- DEF-E2-001 — mandatory editorial enrichment before GitHub/Vercel Preview.
-- Expand-only migration: extends lifecycle and audit constraints. Existing
-- publication documents are normalized by the application compatibility
-- layer and cannot reuse legacy APPLIED labels without execution evidence.

select pg_advisory_xact_lock(hashtext('executa-ai:editorial-e2:v1'));

-- statement-breakpoint
alter table public.editorial_publications
  drop constraint if exists editorial_publications_status_check;

-- statement-breakpoint
alter table public.editorial_publications
  add constraint editorial_publications_status_check check (
    status in (
      'DRAFT', 'CONTENT_READY', 'ENRICHING', 'ADAPTERS_APPLIED',
      'ADAPTER_FAILED', 'VALIDATING', 'VALIDATION_FAILED',
      'READY_FOR_PREVIEW', 'PREVIEW_BUILDING', 'PREVIEW_FAILED',
      'PREVIEW_READY', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED',
      'PUBLISHING', 'PUBLISH_FAILED', 'PUBLISHED', 'QR_FAILED', 'ARCHIVED'
    )
  );

-- statement-breakpoint
alter table public.editorial_events
  drop constraint if exists editorial_events_event_type_check;

-- statement-breakpoint
alter table public.editorial_events
  add constraint editorial_events_event_type_check check (
    event_type in (
      'CREATED', 'CONTENT_UPDATED', 'STATUS_CHANGED', 'ADAPTER_STARTED',
      'ADAPTER_COMPLETED', 'ADAPTER_FAILED', 'GATE_COMPLETED',
      'PREVIEW_ATTACHED', 'REVIEW_RECORDED', 'PUBLISHED'
    )
  );

-- statement-breakpoint
insert into public.app_schema_migrations (migration_id, checksum, details)
values (
  '202607280001_editorial_e2',
  'runtime-verifies-file-sha256',
  jsonb_build_object(
    'defect', 'DEF-E2-001',
    'strategy', 'expand-compatible-read',
    'legacy_applied_trusted', false,
    'preview_requires_gate_evidence', true
  )
)
on conflict (migration_id) do update
  set details = excluded.details,
      applied_at = now();
