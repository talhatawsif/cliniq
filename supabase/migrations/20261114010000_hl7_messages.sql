-- HL7 v2 message log and dead-letter store. RLS on, no policies: server (service_role) only.
create table public.hl7_messages (
  id uuid primary key default gen_random_uuid(),
  received timestamptz not null default now(),
  control_id text not null,
  message_type text not null,
  status text not null check (status in ('accepted','duplicate','failed')),
  outcome text not null,
  raw text not null
);
create index hl7_messages_control_idx on public.hl7_messages (control_id, status);
create index hl7_messages_received_idx on public.hl7_messages (received desc);
alter table public.hl7_messages enable row level security;
