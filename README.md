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
| M2–M7 (MVP) | Not started |
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
