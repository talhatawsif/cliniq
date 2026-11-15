# Compliance map (14-15 Nov 2026)

A self-assessment of the **demo**, against recognised frameworks. It is not a certification, an audit or a claim of
compliance. The app holds synthetic data only. Status: **Met** (control present and evidenced), **Partial**, **Gap**,
**N/A** (not applicable to synthetic data).

Frameworks used as checklists: OWASP ASVS 4.0 (selected areas), Australian Privacy Principles (APP 1-13, Privacy Act 1988),
HIPAA Security Rule safeguards (45 CFR 164.3xx, as an international reference). Healthcare Identifiers Act and My Health
Records Act are out of scope: real IHIs and real records may only be handled by authorised parties.

## Technical safeguards

| # | Control | Status | Evidence / gap |
|---|---|---|---|
| T1 | Authentication on every page and API (ASVS V2; HIPAA 164.312(d)) | Met | `src/proxy.ts`; `tests/e2e/security.spec.ts` |
| T2 | Multi-factor authentication | Gap | One shared demo account, no MFA. Production: per-user sign-in with MFA |
| T3 | Per-user identity and roles (HIPAA 164.312(a)(1), APP 11) | Gap | Audit "who" is always the demo user |
| T4 | Server-side input validation (ASVS V5) | Met | Patient id and IHI checks (`docs/SECURITY.md`), HL7 parser tests, body limit 50 kB |
| T5 | Secrets never reach the browser | Met | `server-only` Supabase client; RLS on with no policies |
| T6 | Constant-time comparison of the integration key | Met | `src/lib/integration.ts` |
| T7 | Cookies: httpOnly, SameSite, encrypted (AES-256-GCM) | Met | `src/lib/smart/session.ts`, `seal.ts` |
| T8 | Transport encryption (ASVS V9; HIPAA 164.312(e)) | Met | HTTPS and HSTS (`max-age=63072000; preload`) seen on the live site; private Cloud Run |
| T9 | Security headers | Partial | CSP, `nosniff`, `no-referrer`, `Permissions-Policy` set (`next.config.ts`). CSP allows `'unsafe-inline'` scripts |
| T10 | Encryption at rest | Partial | Provider-managed (Supabase, Cloud Run/HAPI database). Not configured or verified by the project |
| T11 | Audit controls (HIPAA 164.312(b)) | Partial | Writes, reviews, failed sign-ins, refused HL7 audited. Views capped at 5,000/day, 90-day retention (migration written, not yet applied), not write-once. Other refusals are in Vercel request logs, not the audit table (deliberate: it would let anyone fill it) |
| T12 | Integrity of clinical data | Met | FHIR validation before write, idempotent HL7 keys per sender, human review queue for extracted conditions |
| T13 | Dependency vulnerabilities (ASVS V14) | Met (15 Nov) | `next@16.3.3` had a critical RCE chain and `sharp` a high. Upgraded to `next@16.4.6`; `npm audit --omit=dev` reports 0. CI now runs it (`--audit-level=high`) and Dependabot is on (`.github/dependabot.yml`) |
| T14 | Rate limiting and abuse control | Partial | Daily global quotas on HL7, pipeline, assistant. None per user. CDS Hooks endpoint: in-app limit is per server instance and did not trigger on Vercel; a Vercel Firewall rule is planned (see `docs/SECURITY.md`) |
| T15 | Secret hygiene and rotation | Partial | `GCP_SA_KEY` and `SUPABASE_SECRET_KEY` are long-lived. Production: Workload Identity Federation |
| T16 | Backup and recovery (HIPAA 164.308(a)(7)) | Partial | Documented in `docs/SECURITY.md`: demo data reloads, no real backups (Supabase free plan). Restore never tested |

## Privacy (APPs)

| # | Principle | Status | Evidence / gap |
|---|---|---|---|
| P1 | APP 1 open, transparent management; privacy policy | Partial | Privacy section on `/about`; assistant panel warns about the third-party model. No full privacy policy (demo has no real users) |
| P2 | APP 3 collection limited to what is needed | N/A | Synthetic data. The extraction pipeline stores only extracted findings |
| P3 | APP 6 use and disclosure | **Gap for real data** | The assistant sends chart text to free third-party LLM endpoints that may log prompts (`docs/AI.md`, `docs/llm-model-choice.md`). Never use with real data |
| P4 | APP 8 cross-border disclosure | Gap | Same LLM calls: providers' regions are not controlled |
| P5 | APP 11 security of personal information | Partial | See T1-T16 |
| P6 | APP 11.2 destruction or de-identification when no longer needed | Partial | Audit rows: 90-day purge (migration written, not yet applied). No retention rule for FHIR data (synthetic, reloadable) |
| P7 | APP 12/13 access and correction | N/A | Single demo user |
| P8 | Notifiable Data Breaches scheme | Partial | Procedure written (`docs/BREACH-RESPONSE.md`); never exercised, no named privacy officer |
| P9 | Data minimisation in logs | Met | No resource content in logs; audit detail is a tab name |

## Clinical safety and regulatory

| # | Item | Status | Evidence / gap |
|---|---|---|---|
| C1 | Hazard log | Met | `docs/CLINICAL-SAFETY.md`, `tests/hazard-log.test.ts` |
| C2 | Extraction and coding accuracy measured | Met | `eval/`, NLP tests C1-C16 pass (25 of 25) |
| C3 | Assistant accuracy measured | Partial | `docs/assistant-eval.md`: two runs, model order changed after a timeout |
| C4 | TGA software-as-medical-device classification | Gap | Not assessed. Written up as "path to production" on `/about`, not decided |
| C5 | Accessibility | Met | axe on every page, light/dark, desktop/tablet: 38 Playwright tests pass |

## Order of work

1. ~~T13~~ done.
2. `Permissions-Policy` done. **T14:** create the Vercel Firewall rate-limit rule for the CDS endpoint (dashboard), then drop the in-app limiter. **T9:** CSP nonces still open.
3. ~~T11, P6~~ migration written (apply it); refused requests stay in Vercel logs by choice.
4. ~~P1, P8, T16~~ done: privacy section, breach procedure, backup note. The assistant warning is added, but P3/P4 stay open: chart text still goes to a third-party model.
5. **T2, T3:** per-user sign-in with MFA (Supabase supports it). Largest change and the only one that moves toward real use.

## What can be claimed

"Built against OWASP ASVS and the Australian Privacy Principles as a design reference, with a published gap analysis."
Not: "compliant", "certified", "HIPAA-ready" or "TGA-approved". Not suitable for real patient data.
