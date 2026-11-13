# ClinIQ

Clinical notes and HL7 v2 pathology results → SNOMED CT-AU / LOINC coded FHIR resources with
provenance, shown on an EHR-style patient chart. Built on FHIR R4 (HAPI FHIR), AU Core, CDS Hooks,
SMART on FHIR and HL7 v2.

> Portfolio prototype. Synthetic data only (Synthea). Not a medical device and not clinically validated.

**Live:** https://cliniq-inky-ten.vercel.app (no patient data until the FHIR server is deployed in M2)

## Status

| Milestone | State |
|---|---|
| M0 Foundation and live skeleton | Done |
| M1 Australian cohort | Done — 20 patients, [AU Core validation report](docs/validation/au-core-cohort.md) |
| M2 Private FHIR server in Sydney | Built — final checks pending (cold start, 48 h cost) |
| M3 Design system and chart | Built — worklist, patient chart, tokens, Playwright smoke + axe, [screenshots](docs/ui/screens/m3) |
| M4 Pathology, vitals, FHIR JSON | Built — L1–L11 pass, [screenshots](docs/ui/screens/m4) |
| M5 CDS Hooks service | Built — E1–E14, BMI and care-gap tests pass; sandbox check pending ([docs](docs/cds-hooks.md)) |
| M6 | Done: one-click demo sign-in, audit log, daily quotas, security headers (`docs/SECURITY.md`) |
| M7 | Done: HL7 v2 ORU^R01 → FHIR with ACKs, `/hl7` page, message log. Live check needs the demo password set in Vercel |
| M8–M15 | Not started |

The build is specified in [`SPEC.md`](SPEC.md); the plan and next steps are in
[`docs/PLAN.md`](docs/PLAN.md); decisions are in [`DECISIONS.md`](DECISIONS.md).

## Run locally

Needs Node 24+ and Docker.

```bash
cp .env.example .env.local   # FHIR_BASE_URL=http://localhost:8080/fhir is already set
npm install
docker compose up -d         # HAPI FHIR + Postgres on localhost:8080
npm run load                 # loads the 20 synthetic patients (safe to run twice)
npm run dev                  # app on http://localhost:3000
npm run ci                   # lint, typecheck, unit tests, build
```

Without `FHIR_BASE_URL` the app starts and shows a "FHIR server not configured" notice.

The cohort in `data/cohort/` is built from Synthea output by `npm run cohort:build` and validated
against AU Core by `npm run cohort:validate` (see [`docs/validation`](docs/validation/README.md)).
All data is synthetic.
