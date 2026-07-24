create table if not exists public.newsletter_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique
    check (
      char_length(email) between 3 and 254
      and email = lower(trim(email))
      and position('@' in email) > 1
    ),
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'UNSUBSCRIBED')),
  source text not null
    check (source ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.newsletter_subscription_events (
  audit_id uuid primary key,
  subscription_id uuid not null
    references public.newsletter_subscriptions(id) on delete cascade,
  action text not null
    check (action in ('SUBSCRIBED', 'RESUBSCRIBED', 'UNSUBSCRIBED')),
  source text not null
    check (source ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  created_at timestamptz not null default now()
);

create index if not exists newsletter_events_subscription_idx
  on public.newsletter_subscription_events (subscription_id, created_at desc);

alter table public.newsletter_subscriptions enable row level security;
alter table public.newsletter_subscription_events enable row level security;

revoke all on public.newsletter_subscriptions from public, anon, authenticated;
revoke all on public.newsletter_subscription_events from public, anon, authenticated;

create or replace function public.subscribe_newsletter(
  target_email text,
  target_source text,
  target_audit_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_email text;
  subscription_id uuid;
  previous_status text;
begin
  normalized_email := lower(trim(target_email));

  if char_length(normalized_email) not between 3 and 254
    or position('@' in normalized_email) <= 1
  then
    raise exception 'INVALID_EMAIL' using errcode = '22023';
  end if;

  if target_source is null
    or target_source !~ '^[a-z0-9][a-z0-9_-]{1,63}$'
  then
    raise exception 'INVALID_SOURCE' using errcode = '22023';
  end if;

  select status
    into previous_status
    from public.newsletter_subscriptions
    where email = normalized_email;

  insert into public.newsletter_subscriptions (
    email,
    status,
    source,
    consent_at,
    updated_at
  )
  values (
    normalized_email,
    'ACTIVE',
    target_source,
    now(),
    now()
  )
  on conflict (email) do update
    set status = 'ACTIVE',
        source = excluded.source,
        consent_at = now(),
        updated_at = now()
  returning id into subscription_id;

  insert into public.newsletter_subscription_events (
    audit_id,
    subscription_id,
    action,
    source
  )
  values (
    target_audit_id,
    subscription_id,
    case when previous_status = 'UNSUBSCRIBED'
      then 'RESUBSCRIBED'
      else 'SUBSCRIBED'
    end,
    target_source
  )
  on conflict (audit_id) do nothing;

  return subscription_id;
end;
$$;

revoke all on function public.subscribe_newsletter(text, text, uuid) from public, anon, authenticated;
grant execute on function public.subscribe_newsletter(text, text, uuid) to service_role;

comment on table public.newsletter_subscriptions is
  'Consent records for the public EXECUTA Journal newsletter. Server-only.';
comment on table public.newsletter_subscription_events is
  'Append-only audit trail for newsletter consent changes. Server-only.';
comment on function public.subscribe_newsletter(text, text, uuid) is
  'Idempotent server-only subscription command called by the Vercel Function.';
