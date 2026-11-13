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

## Known limits
- One shared demo account: audit "who" is the same user. Fine for a demo, not for attribution.
- CSP allows inline scripts (Next bootstrap). Move to nonces in the proxy before real data.
- Audit rows are written after the response; a failed write is logged (error code only) and the page still loads.
- `GCP_SA_KEY` and `SUPABASE_SECRET_KEY` are long-lived secrets in Vercel.

## Production replacement
Use **Workload Identity Federation** (Vercel OIDC → GCP) instead of the service-account key, per-user sign-in with MFA, and a write-once audit store.

## Reset
`npm run reset-demo` expunges all FHIR data and reloads the cohort (`LOAD_BASE`/`LOAD_TOKEN` for the cloud server; it needs `HAPI_FHIR_EXPUNGE_ENABLED` and `HAPI_FHIR_ALLOW_MULTIPLE_DELETE`, already set locally and on Cloud Run).
