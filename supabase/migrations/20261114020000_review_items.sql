-- Review queue for auto-extracted Conditions. RLS on, no policies: server (service_role) only.
create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  created timestamptz not null default now(),
  patient_id text not null,
  document_id text not null,
  condition_id text not null unique,
  term text not null,                       -- the note span
  span_start int not null,
  span_end int not null,
  code text not null,                       -- SNOMED CT code proposed
  display text not null,
  confidence numeric not null,
  rationale text not null,
  alternatives jsonb not null default '[]',
  engine text not null,                     -- NLP engine, terminology backend and edition
  status text not null default 'pending' check (status in ('pending','confirmed','changed','rejected')),
  decided_by text,
  decided_at timestamptz
);
create index review_items_status_idx on public.review_items (status, created desc);
alter table public.review_items enable row level security;
