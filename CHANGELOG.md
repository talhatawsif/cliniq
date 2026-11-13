# Changelog

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
