# Changelog

## M0 — Foundation and live skeleton (13 Nov 2026)

- Typed FHIR layer in `src/lib/fhir/` (`@types/fhir`): `fhirFetch` with timeout, retry while the
  server wakes, typed errors; `fhirSearch` with Bundle paging; display helpers for names, codings,
  quantities, dates (DD/MM/YYYY, Sydney) and age.
- `src/lib/env.ts`: environment validated with zod, feature flags.
- "FHIR server not configured" and "not responding" states instead of a crash.
- `/api/health`; `vercel.json` pins functions to Sydney (`syd1`).
- Vitest with 16 unit tests on Synthea fixtures; `npm run ci`; GitHub Actions workflow.
- No `any` left in the source; lint passes.
