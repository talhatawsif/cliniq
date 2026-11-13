# Changelog

## M8 — AU Patient Summary export (14 Nov 2026)

- `src/lib/ps/build.ts` builds an AU PS 1.0.0 document Bundle from confirmed data; `/patient/[id]/summary` (readable view from the
  same Bundle) and `summary.json` (download, audited as an export). `npm run validate:ps`: 0 errors on three patients.

## M7 — HL7 v2 pathology to FHIR (14 Nov 2026)

- `src/lib/hl7v2/`: parser, ORU^R01 to FHIR transaction mapper, ACK builder, processor (pure, injected
  dependencies). `POST /api/hl7v2` (session or `x-api-key`), `/hl7` page with dry run, `hl7_messages` log.
- Ids derive from the filler order number, so resends and corrections update, not duplicate.
- H1–H16 pass; live write, duplicate and correction tested against HAPI.

## M6 — Sign-in, audit, quotas (14 Nov 2026)

- One-click demo sign-in (Supabase Auth), `src/proxy.ts` guarding pages and APIs, `audit_events` and `/audit`,
  daily quotas with a 50 kB body cap, CSP and other security headers, `docs/SECURITY.md`, `npm run reset-demo`.

## M5 — CDS Hooks (14 Nov 2026)

- `/cds-services` discovery and `cliniq-patient-view` (eGFR CKD-EPI 2021, BMI, care gaps); chart decision support.

## M4 — Pathology, vitals, FHIR JSON (14 Nov 2026)

- Analyte trend charts, observation tables with flags, FHIR JSON drawer.

## M3 — Design and chart (14 Nov 2026)

- Design tokens, app shell, worklist, patient chart, Playwright smoke and axe tests.

## M2 — Private FHIR server in Sydney (14 Nov 2026)

- HAPI on Cloud Run (private) with Supabase Postgres, IAM-signed access from the app, billing hard cap.

## M1 — Australian cohort (13 Nov 2026)

- `data/cohort/`: 20 curated, trimmed, Australianised Synthea patients (9 MB) plus shared
  organisations, practitioners and locations; `manifest.json` lists the criteria each patient meets.
- Australianisation: IHI, HPI-I and HPI-O values reserved for testing (no Medicare numbers), Australian
  addresses and phone numbers, indigenous status "not stated", pathology in SI units re-coded to
  molar LOINC codes, US extensions and billing resources removed, notes scrubbed.
- `data/sample-notes/`: 12 hand-written Australian-style notes attached to cohort patients.
- `docs/validation/au-core-cohort.md`: every resource with an AU Core 2.0.0 profile validates
  against it; 0 errors in the proof run.
- `docker-compose.yml` (HAPI + Postgres) and `npm run load`: idempotent load, 74 MB database.
- Audit fixes: CI typecheck on a clean checkout, malformed settings no longer crash the app,
  validation cannot overwrite the cohort from a broken run.
- Scripts: `cohort:build`, `cohort:check`, `cohort:validate`, `load`; 13 new unit tests.

## M0 — Foundation and live skeleton (13 Nov 2026)

- Typed FHIR layer in `src/lib/fhir/` (`@types/fhir`): `fhirFetch` with timeout, retry while the
  server wakes, typed errors; `fhirSearch` with Bundle paging; display helpers for names, codings,
  quantities, dates (DD/MM/YYYY, Sydney) and age.
- `src/lib/env.ts`: environment validated with zod, feature flags.
- "FHIR server not configured" and "not responding" states instead of a crash.
- `/api/health`; `vercel.json` pins functions to Sydney (`syd1`).
- Vitest with 16 unit tests on Synthea fixtures; `npm run ci`; GitHub Actions workflow.
- No `any` left in the source; lint passes.
