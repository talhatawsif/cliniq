-- Audit log (shaped like FHIR AuditEvent) and daily global quotas. RLS on, no policies:
-- only the server (service_role, which bypasses RLS) reads or writes. The anon key sees nothing.
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  recorded timestamptz not null default now(),
  agent text not null,                                   -- who: auth user id or "system"
  action text not null check (action in ('view','export','write','review','sign-in')),
  entity text,                                           -- resource reference, e.g. Patient/123
  outcome text not null default 'success' check (outcome in ('success','failure')),
  detail text                                            -- short, never patient content
);
create index audit_events_recorded_idx on public.audit_events (recorded desc);
create index audit_events_entity_idx on public.audit_events (entity);
alter table public.audit_events enable row level security;

create table public.quotas (
  name text not null,
  day date not null default (now() at time zone 'utc')::date,
  used int not null default 0,
  primary key (name, day)
);
alter table public.quotas enable row level security;

-- Atomically takes one unit; false when the day's limit is reached.
create function public.consume_quota(p_name text, p_limit int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.quotas (name) values (p_name) on conflict (name, day) do nothing;
  update public.quotas set used = used + 1
    where name = p_name and day = (now() at time zone 'utc')::date and used < p_limit
    returning used into n;
  return n is not null;
end $$;
revoke all on function public.consume_quota(text, int) from public, anon, authenticated;
grant execute on function public.consume_quota(text, int) to service_role;
