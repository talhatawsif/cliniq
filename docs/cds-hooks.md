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

## The CDS Hooks sandbox check (done, 14 Nov 2026)
The public sandbox (https://sandbox.cds-hooks.org) accepted the discovery URL above, found `cliniq-patient-view`, called it with its
own patient's prefetch (Casimira Nicolas) and showed the cards: BMI 29.5 (overweight) and the diabetes and hypertension care gaps.
Screenshot: [`docs/ui/screens/m5/sandbox.png`](ui/screens/m5/sandbox.png). To repeat it by hand: Settings, Add CDS Services,
paste the discovery URL. To repeat it automatically: `npx playwright test -c playwright.sandbox.config.ts`.
The sandbox's patients carry different data from ClinIQ's, so which cards appear depends on the patient.

Without the sandbox, the same behaviour is covered by `src/lib/cds/route.test.ts` and the Playwright test
"CDS Hooks: discovery prefetch works against FHIR and returns cards".
