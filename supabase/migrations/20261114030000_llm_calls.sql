-- One row per model request. No question text, answer text or patient identifiers. RLS on, server only.
create table public.llm_calls (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  model text not null,
  latency_ms int not null,
  prompt_tokens int,
  completion_tokens int,
  cost numeric not null default 0,
  outcome text not null check (outcome in ('ok','filtered_empty','no_answer','refused','timeout','rate_limited','error','canary','empty'))
);
create index llm_calls_at_idx on public.llm_calls (at desc);
alter table public.llm_calls enable row level security;
