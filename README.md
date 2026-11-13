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
| M1–M7 (MVP) | Not started |
| M8–M15 | Not started |

The build is specified in [`SPEC.md`](SPEC.md); the plan and next steps are in
[`docs/PLAN.md`](docs/PLAN.md); decisions are in [`DECISIONS.md`](DECISIONS.md).

## Run locally

```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev     # app on http://localhost:3000
npm run ci      # lint, typecheck, unit tests, build
```

Without `FHIR_BASE_URL` the app starts and shows a "FHIR server not configured" notice.
