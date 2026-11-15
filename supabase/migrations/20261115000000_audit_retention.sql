-- Audit retention: rows older than 90 days are deleted daily (APP 11.2: do not keep personal information longer than needed).
-- shortcut: 90 days suits a demo; a real clinical system keeps audit records for years (HIPAA 164.316 asks for 6), so change the interval and archive first.
create extension if not exists pg_cron;
select cron.schedule(
  'purge-audit-events',
  '17 3 * * *',
  $$delete from public.audit_events where recorded < now() - interval '90 days'$$
);
