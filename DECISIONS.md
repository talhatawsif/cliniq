# Decisions

One entry per decision: what changed and why. Newest section first. Implementers add one line per
decision made during a milestone.

## 13 Nov 2026 — Audit fixes after M1

- **Identifiers are no longer generated.** Random IHI and Medicare numbers with valid check digits
  sit in the real number ranges and could equal a real person's. Patients, practitioners and
  organisations now use IHI, HPI-I and HPI-O values that Services Australia reserves for testing,
  copied from HL7 Australia's test data (CC0, commit `71ee5b9`) into
  `scripts/cohort/test-identifiers.json`. **Medicare numbers were removed**: HL7 Australia states
  there is no reserved test range for them. The cohort check fails on any identifier outside the
  test pools.
- **CI was red on GitHub** (`LayoutProps` not found): Next.js generates that type, so `typecheck`
  now runs `next typegen` first. Local runs had hidden this because the generated types already
  existed. Lesson: verify CI on GitHub, not only locally.
- The cohort check now requires every Patient to claim AU Core Patient, so a rebuild committed
  without `cohort:validate` fails CI.
- `cohort:validate` refuses to rewrite the cohort when the trial run shows Patient failures or
  terminology-server errors (an outage would otherwise strip every claim).
- A malformed environment value no longer crashes every route: it is ignored, named in
  `/api/health` (`status: "degraded"`), and `FHIR_BASE_URL` must be an http(s) address.

## 13 Nov 2026 — M1 (Australian cohort)

- **Cohort is a curated list, checked by code.** `scripts/cohort/selection.ts` names the 20
  patients and the criteria each was picked for; the build fails if a claim is not true of the
  source record. Only one living woman aged 75+ exists in the source, so that criterion is now
  "woman aged 70 or over" (SPEC §3 updated).
- **One build script, not four.** Select, trim, Australianise and check run as steps of
  `npm run cohort:build`; validation is separate because it takes minutes and needs Java.
- **History window shrinks per patient until the bundle fits** (5 years down to 3 for the three
  heaviest patients) instead of capping observations arbitrarily.
- **Validation uses HL7 Australia's terminology server** (`tx.dev.hl7.org.au`). With the validator's
  default server almost every resource "failed" because it cannot evaluate SNOMED CT-AU value
  sets; that was a tooling artefact, not a data fault.
- **Result: every resource with an AU Core profile passes it** (Patient, Condition, Encounter,
  Procedure, medicines, immunisations, allergies, pathology results, vital signs, organisations,
  practitioners, locations). This corrects the v3 spec's expectation that RxNorm and CVX coded
  resources would fail: AU Core prefers Australian codes but does not require them. They are still
  labelled as US codes in the app. Extensible-binding misses are warnings and are listed in the report.
- **Fixes the validator forced:** the SNOMED CT codes each AU Core vital-sign profile fixes were
  added next to LOINC; four LOINC displays with wrong capitalisation were corrected; one display
  the servers disagree on was removed; SNOMED codes Synthea filed under the LOINC system were
  re-filed; resources coded only in the US SNOMED extension (not in SNOMED CT-AU) were dropped.
- **ClinIQ's own URLs use `https://github.com/talhatawsif/cliniq/fhir`**: the validator rejects
  `example.org` inside data.
- **Organisations, practitioners and locations are Australianised too** (names, addresses, test HPI-O
  and HPI-I values) and stored once in `data/cohort/_shared.json`. Synthea's
  search-style references to them are rewritten to plain `Type/id` references.
- **Bundles are stored as transactions of `PUT` by id, one entry per line**: loading twice changes
  nothing (verified: same counts, no new versions), and diffs stay readable.
- **Measured database size: 74 MB** for the whole cohort on local Postgres (budget 250 MB), about
  8× the 9 MB of JSON. The v2 guess of 7× was close.
- **Codes confirmed by `$lookup`:** all molar LOINC codes and note-type codes on tx.fhir.org, the
  vital-sign SNOMED codes on the HL7 AU server. The indigenous-status code system and code "9"
  were accepted by the validator.
- **Known data oddities left as generated:** some creatinine values are implausibly high for the
  reported eGFR (Synthea), which will matter for the eGFR card in M5; note text is Synthea template
  prose apart from the 12 hand-written notes.
- `package.json` now has `"type": "module"` so Node runs the TypeScript scripts directly without a
  build step or an extra dependency. HAPI is pinned to `v8.12.0-2` in `docker-compose.yml`.
- Not verified: the ACMA fictional phone numbers were written from memory.

## 13 Nov 2026 — M0

- `await connection()` on the home page instead of `export const dynamic`: Next.js 16 drops the
  `dynamic` segment option under Cache Components, and patient data must never be read at build.
- `fhirSearch` only follows a paging link on the same host as `FHIR_BASE_URL`: the link comes from
  the server, and following it elsewhere would be a request-forgery path. M2 must confirm HAPI on
  Cloud Run emits links with its public address.
- Retries are short (2 retries, about 3 s in total) and the page then shows "not responding". A
  full cold start is longer; the waiting state with automatic retry is built with the chart (M3).
- `@types/node` moved to 24 (Vitest 5 requires 22 or 24+); CI runs Node 24.
- Empty values in `.env` files are treated as unset, so the template can be copied as is.
- Prettier ignores Markdown and fixtures so `npm run format` does not rewrap the documents.
- `/api/health` is liveness only for now; the deep check belongs to M2.
- Verified live on 13 Nov 2026 at https://cliniq-inky-ten.vercel.app: `/api/health` 200 at commit
  `d312f95`, served from `syd1`, home page shows "FHIR server not configured".

## 13 Nov 2026 — UI and AI plans (`docs/UI.md`, `docs/AI.md`)

| Decision | Why |
|---|---|
| A written design contract with tokens, a banned list and screenshot checks, set up in M3 | "Professional, not generic" cannot be left to each session's taste; the contract and the committed screenshots make it checkable, and the owner signs off visually. |
| Dense clinical workstation look: neutral greys, colour for meaning only, hairlines not cards, Public Sans + IBM Plex Mono | Reads as hospital software; avoids the gradient/purple/card-grid look of generated dashboards. Replaces the Next.js starter fonts. |
| One visual treatment for all machine output; teal, not purple; no sparkle icons | Reviewers must be able to tell at a glance what a clinician has not verified. |
| shadcn/ui (Radix) primitives restyled to the tokens; plain tables; Recharts kept | Accessible dialogs, drawers and comboboxes are not worth hand-writing; a data-grid library is not needed for 20 patients. |
| Building sessions use the frontend-design plugin, shadcn MCP and Playwright MCP | Design guidance, correct component usage, and the ability to look at the result before calling a card done. |
| Medicines follow the ACSQHC on-screen medicines display guidance; the patient banner uses the common family-name-in-capitals convention | The v3 spec cited an "Australian on-screen identification guidance" for the banner that could not be confirmed; the claim is removed and only the medicines guidance is cited. |
| Assistant is deterministic first (pre-filter, scripted answerer, cache) and calls a model only for free-form questions | Most questions cost no request, which matters with 50 a day, and the default experience is instant. |
| Output filter also drops any sentence whose numbers or dates are not in its cited facts (test A13) | Citations alone do not stop an invented value attached to a real citation. |
| Plain-line output format, not JSON mode; no streaming of unfiltered text | Free models support structured output unevenly; unfiltered text must never reach the screen. |
| The UI says when the filter removed sentences, and labels rule-based output as rule-based, not "AI" | Honesty about what is and is not a language model, and about its reliability. |
| Assistant hidden in SMART mode by default | Sandbox data would be sent to a third-party model. |
| `llm:probe` and `assistant:eval` scripts; `llm_calls` logs metadata only | Free models change weekly; swapping must be configuration, and results must be dated evidence. |

Not verified: that shadcn's current CLI works unchanged with this Next.js version and Tailwind 4
(M3 checks and logs it); the install commands for the three tools are from current documentation
and third-party guides.

## 13 Nov 2026 — OpenRouter key

The owner keeps the OpenRouter key that was once pasted into a chat instead of rotating it. Accepted
because the account holds $0 credit with auto top-up off, so the key can only reach `:free` models
and the worst case is someone using up the 50 requests/day. Rotate it if credit is ever added.

## 13 Nov 2026 — Spec review (v2 → v3), before any feature code

Limits were checked against vendor documentation on this date. Items marked *(unverified)* could
not be confirmed and are written into the spec as checks for the implementer.

### Design flaws and wrong assumptions fixed

| # | Change | Why |
|---|---|---|
| 1 | HAPI moves from `us-central1` to `australia-southeast1`; Vercel functions pinned to `syd1` | The database is in Sydney. HAPI makes many SQL round trips per request; across the Pacific each chart load would take seconds and the data load would crawl. Australian data residency is also a point reviewers look for. |
| 2 | HAPI becomes private (Cloud Run IAM, service-account ID token from the Next.js server) | The v2 plan left a writable FHIR server open to the internet, including cascade delete. That is the first thing a health-IT reviewer would flag. |
| 3 | Deployment moves from the last card (M15) to the first (M0) | A portfolio that is not live until the end is not a portfolio for most of the build. |
| 4 | Keep-alive moves from GitHub Actions to cron-job.org | GitHub switches off scheduled workflows after 60 days without repository activity, so the keep-alive would silently stop and Supabase would pause. |
| 5 | Pinger also keeps HAPI warm during Sydney daytime | Under request-based billing idle instances are not billed, so staying warm is free, and a 1–2 minute cold start loses reviewers. Guarded by an instance-start check because repeated cold starts would use the allowance. |
| 6 | Cloud Run free allowance corrected to 180,000 vCPU-s / 360,000 GiB-s | v2 quoted the instance-based figures. Sydney is a Tier 2 price region, so the allowance goes less far (about 17 h of request time a month at 2 vCPU / 2 GiB). |
| 7 | Images pulled from public Docker Hub; no Cloud Build or Artifact Registry | Artifact Registry is free only up to 0.5 GB; a HAPI image alone is larger. |
| 8 | Database budget lowered from 350 MB to 250 MB, measured on local Postgres first; per-patient cap 750 kB | Supabase goes read-only above 500 MB, HAPI keeps old versions, and the demo accepts writes. The "7× expansion" figure in v2 was a guess; it is now measured. |
| 9 | HAPI uses the session pooler with pool size 5 | Direct connections are IPv6-only and Cloud Run cannot reach them; free-tier connection limits are small. |
| 10 | Pathology converted to SI units **and re-coded** to molar LOINC codes | Australian labs report µmol/L and mmol/L. A LOINC code is specific to the measured property, so changing the unit without the code would be wrong. |
| 11 | Trending groups by analyte, not one LOINC code | The data has creatinine under two codes and SpO2 under two codes; v2's "group by LOINC code" would have split them. |
| 12 | "Map terminology to SNOMED CT-AU/AMT" removed from the Australianise step | SNOMED codes in Synthea are already valid in the AU edition; there is no free RxNorm → AMT map. Medications stay RxNorm and are labelled as such. |
| 13 | Synthea notes are scrubbed and not used to test NLP; 12 hand-written Australian notes are | Synthea notes are templates with no negation or family history, and they state race and a US insurer. |
| 14 | ICD-10-AM removed | It is licensed by IHACPA, and the SNOMED CT-AU → ICD-10-AM map requires that licence. Saying so is more credible than faking it. |
| 15 | AU Core validation runs with the HL7 validator CLI, not by loading the IG into HAPI | Loading IG packages into HAPI costs database space and start-up time on a 500 MB database. |
| 16 | AU Core validation moves into the data card (M1) | The data should be shaped to AU Core from the start, not retrofitted at M11. |
| 17 | HL7 v2 mapping moves out of n8n into tested TypeScript behind `POST /api/hl7v2`; n8n only orchestrates | Logic inside n8n nodes cannot be unit-tested and is invisible on the live site (n8n runs on the Mac). Now it works live and n8n is still used for what integration engines do. |
| 18 | HL7 v2 gains ACK/AE/AR replies, patient matching by IHI (never creating patients), idempotency on MSH-10, corrected results | Expected behaviour of any real pathology interface. |
| 19 | CDS Hooks service is prefetch-only | Calling the `fhirServer` URL from the request is a server-side request forgery risk on a public endpoint. |
| 20 | Assistant uses one LLM call per question with server-built facts, not a tool-calling loop | 50 free requests a day; a tool loop spends several per question, and free models support tool calls unreliably. |
| 21 | Cloudflare Workers AI fallback removed | The owner's rule is OpenRouter `:free` only. The scripted answerer is the fallback. |
| 22 | Cost circuit breaker added to the LLM client | A model id ending in `:free` should cost nothing; if a response ever reports a cost, stop. |
| 23 | scispaCy and SapBERT removed from the NLP service | PyTorch and a 400 MB model make the image and cold start too heavy for the free tier and the $1 limit; medspaCy with a target list covers the demo. |
| 24 | TypeScript rules engine and live LLM extraction removed; `precomputed` kept | Two more engines to build and test for little gain. Precomputed results cover the case where the NLP service is asleep. |
| 25 | UMLS backend removed; public CSIRO Ontoserver endpoint added as the no-credentials path *(unverified: its terms and uptime)* | UMLS is US-centred and needs another approval. One Ontoserver client covers NCTS and the public endpoint. |
| 26 | CSIRO synthetic dataset evaluation removed | Unclear licence, extra work, no gain over Australianised Synthea. |
| 27 | Daily write quotas, body-size limits and `reset-demo` added | A public demo with a shared login can otherwise fill a 500 MB database. |
| 28 | eGFR card wording: "eGFR category", ">90" display, adults only | CKD needs persistence over 3 months; Australian labs report values above 90 as ">90"; the formula is not valid for children. |
| 29 | CDS rules and the patient summary ignore unconfirmed Conditions | Otherwise an unreviewed machine suggestion would drive decision support. |
| 30 | Optional MCP server removed | Not asked for, no reviewer value. |

### Reordering

Ranked by reviewer impact against effort. Old → new: Foundation M0 → M0 (plus deploy) · Data M1 →
M1 (offline) + M2 (cloud) · Chart M2 → M3 · Labs M3 → M4 · CDS Hooks M4 → M5 · Auth M5 → M6 ·
n8n HL7 v2 M9 → M7 (as an app feature) · AU Core M11 → M1 (validation) + M8 (AU Patient Summary) ·
NLP M6 → M9 · Coding M7 → M10 · Write-back M8 → M11 · SMART M10 → M12 · Assistant M12 → M13 ·
n8n M9 → M14 · Eval M13 + Polish M14 → M15 · Keep-alive M15 → M2.

MVP line after M7: live, Australian-shaped, chart + pathology + CDS Hooks + HL7 v2, secured.
HL7 v2 and AU Core moved ahead of the NLP pipeline because they are cheaper and are what
Australian integration and interoperability roles screen for. Headline line after M11.

### Added (free, expected by an Australian health-IT engineer)

AU Patient Summary 1.0.0 export · IHI with a valid check digit and correct identifier system ·
indigenous-status extension set to "not stated" · consistent patient banner · Australian ConText rules ("nil", PMHx, FHx) and spellings (GORD) ·
clinical-safety hazard log · Path to production covering TGA, Privacy Act, My Health Records Act,
Healthcare Identifiers Act and licensing · `docker-compose` so a reviewer can run it locally ·
optional Inferno AU Core run *(unverified that it fits on the 8 GB Mac)*.

### Acceptance tests

Every "Done when" is now a command, a test or an observable result. Exact tests were added for
LOINC grouping (L1–L11), CKD-EPI 2021 (E1–E14, values computed from the published formula), HL7 v2
mapping (H1–H16), ConText (C1–C16), terminology (12 terms), write-back and Provenance (W1–W12) and
assistant guardrails (A1–A12).

Codes in the spec (molar LOINC codes, SNOMED concept ids, the indigenous-status code system) were
written from memory and **must be confirmed with `$lookup` by the implementer** before they go
into tests; SPEC §0 makes this a rule.

### Not verified

- Supabase free-tier pooler connection limits (the docs page did not list them).
- Whether the public CSIRO Ontoserver endpoint may be used for a public demo.
- The exact Tier 2 price multiplier for Cloud Run in Sydney (third-party sources say about 1.4×).
- Cold-start time of HAPI against Supabase; M2 measures it.

## 13 Nov 2026 — M2

- HAPI v8.12.0-2 on Cloud Run `australia-southeast1`, private; Supabase session pooler (aws-0, port 5432), schema `hapi`, pool 5. Database 74 MB after loading 20 patients.
- Billing is in **AUD**, so the budget is 1 AUD. A budget only alerts: the hard cap is `infra/billing-cap` (budget → Pub/Sub → function that detaches billing). The no-trip path is tested; the detach itself is not (it would switch billing off). Billing data lags by hours, so spend can overshoot slightly.
- The cap function needed Cloud Build/Artifact Registry (SPEC said none); costs are inside the free tiers.
- App auth to Cloud Run uses a service-account key (`GCP_SA_KEY`, Sensitive in Vercel) and a hand-signed ID token (no new dependency). Shortcut: long-lived key; move to workload identity federation if the project outlives the demo.
- The database password is a plain env var on the Cloud Run service. Shortcut: move to Secret Manager.
- Open: real cold start (deploys leave the revision warm, so early timings were not cold); pinger; 48 h cost check. The Supabase secret key and the service-account key were shared in chat — rotate both.

## 14 Nov 2026 — M3

- `/` redirects to `/patients` until sign-in exists (M6); the signed-out landing page is not built.
- Patient list shows name, DOB (age), sex and IHI. Active-problems and last-encounter columns (UI.md §7) are skipped: they cost two extra FHIR queries per row. Revisit if the worklist needs them.
- Chart sections are anchors on one page, not separate routes; the right rail (decision support) and the 768–1279 px drawer arrive with M5.
- The old Recharts `VitalsChart` was deleted (smoothed lines and raw hex breach UI.md §2); charts are rebuilt in M4.
- Unconfirmed conditions use the machine treatment, but no fixture patient has one, so it is not yet seen in screenshots.
- E2E runs against local Docker HAPI (`docker compose up -d && npm run load && npm run e2e`); paging past one page is untested because 20 patients fit on one page.
- Not done: shadcn/Radix primitives (no drawer or dialog needed yet) and the frontend-design / Playwright MCP tools (not installed; Playwright runs as a test dependency instead).
