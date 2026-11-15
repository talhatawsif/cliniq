# Security (M6)

Prototype with synthetic data only. Not for real patient data without the changes at the end.

## Threat model (short)
| Threat | Control |
|---|---|
| Anonymous access to charts or APIs | `src/proxy.ts`: pages redirect to `/sign-in`, `/api/*` returns 401. Public: `/sign-in`, `/about`, `/cds-services`, `/api/health` |
| Reading the audit log or quotas from the browser | RLS on, no policies: the publishable (anon) key sees nothing. Only the server's secret key reads or writes (`src/lib/supabase.ts`, `server-only`) |
| Filling the database or burning free-tier limits | Daily global quotas (50 HL7, 50 pipeline, 40 assistant), bodies ≤ 50 kB (`src/lib/quota.ts`) |
| Clickjacking, content sniffing, referrer leaks | CSP with `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer` (`next.config.ts`) |
| Public reach of the FHIR server | Private Cloud Run; only the `cliniq-web` service account can invoke it |
| Runaway cloud spend | Budget alert → function detaches billing at 1 AUD (`infra/billing-cap/`) |
| Patient content in logs | No `console` calls carry resource data; audit `detail` is a tab name, never content |

## Review of 14 Nov 2026 (fixed)
- Patient ids from the URL are checked before they go into any FHIR search (an id such as `x&_include=*` used to reach the server from the chart pages).
- The IHI from an HL7 message must be exactly 16 digits before it is used in a search (a crafted PID-3 could add another identifier system to the match).
- HL7 resource ids are scoped to patient and sender (a message reusing a filler order number could overwrite, and re-assign, another patient's result).
- Failed sign-ins and refused HL7 writes are now audited with outcome `failure`.

## Known limits
- `/api/health?deep=1` is public by design (the keep-alive pinger) and wakes the FHIR server; it reports the database size. The result is reused for 30 s per server instance.
- Audit rows for chart views and sign-ins are capped at 5,000 a day (`audit` quota); writes and reviews are always recorded. Rows older than 90 days are deleted daily by a `pg_cron` job (`supabase/migrations/20261115000000_audit_retention.sql`).
- The CDS Hooks endpoint is public and does no I/O (prefetch only). An in-app limit of 60 requests a minute per caller IP (`src/lib/cds/ratelimit.ts`) counts per server instance. On Vercel requests spread across instances, so it does **not** reliably limit (62 requests in a row were all served on 15 Nov). The real control is a Vercel Firewall rate-limit rule (path `/cds-services/cliniq-patient-view`, POST, 60 per 60 s per IP, deny), not yet created.
- Refused requests other than sign-in and HL7 (401s, 403 `smart-read-only`, 429s) are not written to the audit log. They show as status codes in the Vercel request logs. Writing them to the audit table would let anyone fill it, so it is skipped on purpose.
- One shared demo account: audit "who" is the same user. Fine for a demo, not for attribution.
- CSP allows inline scripts (Next bootstrap). Move to nonces in the proxy before real data.
- Audit rows are written after the response; a failed write is logged (error code only) and the page still loads.
- `GCP_SA_KEY` and `SUPABASE_SECRET_KEY` are long-lived secrets in Vercel.

## Backup and recovery
FHIR data is synthetic and reloads from `data/cohort` (`npm run reset-demo`). Supabase's free plan does not include backups (check the dashboard), so audit rows, quotas and the review queue are lost if that project is deleted; the app recreates the tables from `supabase/migrations/`. Acceptable for a demo, not for real records. Breach steps: `docs/BREACH-RESPONSE.md`.

## Production replacement
Use **Workload Identity Federation** (Vercel OIDC → GCP) instead of the service-account key, per-user sign-in with MFA, and a write-once audit store.

## Reset
`npm run reset-demo` expunges all FHIR data and reloads the cohort (`LOAD_BASE`/`LOAD_TOKEN` for the cloud server; it needs `HAPI_FHIR_EXPUNGE_ENABLED` and `HAPI_FHIR_ALLOW_MULTIPLE_DELETE`, already set locally and on Cloud Run).
