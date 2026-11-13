# ClinIQ

Clinical notes and HL7 v2 pathology results → SNOMED CT-AU / LOINC coded FHIR resources with
provenance, shown on an EHR-style patient chart. Built on FHIR R4 (HAPI FHIR), AU Core, CDS Hooks,
SMART on FHIR and HL7 v2.

> Portfolio prototype. Synthetic data only (Synthea). Not a medical device and not clinically validated.

**Status:** Phase 1 (patient list, chart, vitals charts) works against HAPI FHIR. The full build is
specified in [`SPEC.md`](SPEC.md); the plan and next steps are in [`docs/PLAN.md`](docs/PLAN.md).

## Run locally

```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev
```
