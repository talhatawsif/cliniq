# CDS Hooks service

Discovery: `GET https://cliniq-inky-ten.vercel.app/cds-services`
Service: `POST /cds-services/cliniq-patient-view` (`patient-view` hook). CORS is open on `/cds-services` only.

- **Prefetch only.** The service reads `prefetch` and never calls the `fhirServer` in the request.
  No prefetch, or no `patient` in it, returns `{"cards": []}` with status 200.
- Prefetch templates (from discovery): `patient`, `conditions`, `creatinine` (10 latest), `weight`,
  `height`, `hba1c`, `bp` (1 latest each). The patient chart uses the same rules and queries.
- Cards: eGFR category (CKD-EPI 2021, adults, latest creatinine within 12 months), BMI (adults,
  from latest weight and height), care gaps (diabetes without HbA1c, hypertension without BP in
  365 days). Conditions must be active and not unconfirmed, refuted or entered in error.
  Deceased patients get no cards. Rules and tests: `src/lib/cds/`.

## Try it in the CDS Hooks sandbox (owner step — not yet done)
1. Open https://sandbox.cds-hooks.org, choose **Settings → Add CDS Services**, paste the discovery URL above.
2. Pick a patient in the sandbox's own FHIR server. Its data differs from ClinIQ's, so cards appear only
   if that patient has creatinine, weight/height, HbA1c or BP results.
3. Save a screenshot of the cards in this folder (`docs/ui/screens/m5/sandbox.png`) and tick M5 in the README.

Without the sandbox, the same behaviour is covered by `src/lib/cds/route.test.ts` and the Playwright test
"CDS Hooks: discovery prefetch works against FHIR and returns cards".
