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
- 14 Nov 2026: after an idle period the Sydney HAPI hung with all 5 Hikari connections stuck (dead sockets; Cloud Run freezes CPU between requests and the pooler drops idle connections). Fixed on the service with `socketTimeout=15&connectTimeout=10&tcpKeepAlive=true` on the JDBC URL plus Hikari `maxLifetime=120000` and `keepaliveTime=30000`. Verified fresh, **not yet verified after a long idle** — check after the next idle gap.

## 14 Nov 2026 — M4

- Patient banner, section nav and the FHIR JSON drawer moved into `patient/[id]/layout.tsx`; Patient, Condition and AllergyIntolerance reads are `cache()`d so the layout and pages share them. Chart sections are now three routes: Summary, Pathology, Vitals.
- The JSON drawer is a native `<dialog>` (focus trap and Esc for free), one per chart, with a small regex highlighter (tokens only). Resources are embedded in the page rather than fetched on demand, so no new read endpoint exists before sign-in (M6).
- Results table merges value and unit (`14 /min`, `7.0 % (53 mmol/mol)`) instead of a separate unit column; a BP panel shows `130/80 mmHg`.
- The cohort has no reference ranges or interpretations, so no band or flag is drawn in the screenshots; unit tests cover both. Series with a single point are listed in the table but not charted.
- Mixed units: only analytes in the SPEC conversion table are merged; other analytes are never converted. `valueQuantity.code` (UCUM) drives conversion.

## 14 Nov 2026 — M5

- Rules live in `src/lib/cds/rules.ts` as pure functions with an injected `now`; the CDS service and the chart share them and the prefetch queries, so the chart cannot drift from the service.
- "Conditions the rules may use" = active and not unconfirmed/provisional/differential/refuted/entered-in-error (the spec lists three statuses; resolved and the other two are excluded too).
- A BMI card is shown for every adult category including healthy weight (the spec classifies all four); a deliberate "not calculated" card is shown for under-18s and unknown sex only when a creatinine within 12 months exists.
- The BMI is computed from the latest weight and height, not from a recorded BMI observation.
- `uuid` is random per request, so cards are not stable across calls.
- Not verified: the cds-hooks sandbox (needs a browser session by the owner; steps in `docs/cds-hooks.md`).

## M6: sign-in, audit, quotas
- One-click sign-in is a server action that signs in a shared Supabase user with a stored password (no typing). Anyone can press the button; that is the demo design.
- Audit rows are written with `after()` so views are not slowed; written per chart tab render (summary, pathology, vitals), only for patients that exist. Export/write/review actions arrive in later milestones.
- Quotas use one atomic SQL function (`consume_quota`, service_role only). The HL7/pipeline/assistant routes do not exist yet, so the 429 is tested on the helper (limit 2), not over HTTP.
- CSP keeps `'unsafe-inline'` for scripts (shortcut, see SECURITY.md).

## M7: HL7 v2 ORU^R01 → FHIR
- Resource ids are a hash of filler order number (+ test code + OBX-4), written as a transaction of PUTs. A resend or a correction updates the same resource (version 2) instead of duplicating; no search-then-write race.
- Bundle `fullUrl` values are deterministic `urn:uuid`s because HAPI's validator requires absolute URLs; references stay `Type/id`.
- A timestamp with no offset in the field or MSH-7 is cut to a date rather than guessing a time zone.
- Duplicate = same MSH-10 already stored as accepted. Failed messages are logged, so a corrected resend of the same id is processed.
- ACK text escapes `^` etc. (`ADT\S\A01`), as HL7 requires. HTTP status is 200 for every processed message; the ACK carries the result. FHIR down returns 503 and nothing is logged, so the sender retries.
- Spec reference message uses IHI 8003608833357361, which is not in the cohort, so it is the "unknown patient" sample; `oru-demo-creatinine.hl7` targets a real cohort patient.
- Shortcut: one OBR per message; extra orders are ignored.

## M8: AU Patient Summary export
- "No information" for an empty required section is `section.emptyReason` (`unavailable`) with narrative, not an entry. The IPS version AU PS 1.0.0 builds on (2.0.1) has no absent/unknown code system, its rule ips-comp-1 accepts either entries or an empty reason, and a SNOMED "no known allergy" entry would claim more than "none recorded".
- Included: confirmed and active conditions and allergies, active medication requests (with their Medication and requester Practitioner), completed immunisations, the latest final laboratory result per LOINC code. A document must be self-contained, so references to resources not in it (Encounter, performers, organisations) are dropped.
- Author is a Practitioner and custodian an Organization (FHIR allows only an Organization there), both named for the app's owner, at their request. No qualifications or identifiers are claimed.
- The cohort has no patient without allergy records, so `validate:ps` removes the third patient's allergies to test that path.
- Skipped: the optional Inferno AU Core test kit run (not attempted on the 8 GB Mac).
- Validation warnings are mostly terminology (US RxNorm/CVX codes, SNOMED editions the HL7 AU terminology server does not hold); counts are in `docs/validation/au-ps.md`.

## M9: NLP extraction service
- Image is in Artifact Registry (Sydney), not Docker Hub: there is no Docker Hub account to push to, and the first 0.5 GB of storage is free. Cloud Run (1 vCPU, 1 GiB, max 1, min 0) stays inside the free tier, so the project's 1 AUD cap is not at risk.
- No spaCy language model: the pipeline uses a blank English tokeniser, so there are no noun chunks. The spec suggested noun chunks as extra targets; they would send phrases like "the patient" forward to coding, so targets come only from `targets.json` (cohort condition names, synonyms, abbreviations, Australian spellings).
- A heading governs its own paragraph only. medspaCy's default would let "Allergies:" label everything after it until the next heading, which mislabels sections and could mark later entities as family history.
- `historical` comes only from ConText phrases ("history of"), not from the PMHx heading, so `PMHx: HTN` is affirmed (C10).
- "is unlikely" maps to `uncertain`, so "Heart failure is unlikely" is held back from coding rather than affirmed.
- The service's output for the 12 sample notes is committed (`data/nlp/precomputed.json`) and used, labelled, when `NLP_SERVICE_URL` is unset or the service does not answer.
- The service-account invoker grant for `cliniq-nlp` is an owner step (the auto-mode classifier blocks IAM grants).

## Measurements (14 Nov 2026)
- FHIR server cold start (scaled to zero, CPU boost on): 56.6 s for the first request, 0.25 s warm.
- Idle-connection fix: after 13 minutes idle with the instance still running, the next request took 1.1 s and `/api/health?deep=1` on Vercel reported FHIR and database ok. Not tested beyond 13 minutes.
- NLP service: image 131 MB compressed (561 MB unpacked); cold start 3.8 s after about 18 minutes idle, 0.18 s warm.
- Not done: the 48 hour cost check for the FHIR server, the billing-cap detach path (testing it would switch billing off), and the cron-job.org pinger (needs the owner's account).

## M10: terminology coding
- Backends: NCTS (if `TERMINOLOGY_CLIENT_ID`/`SECRET` are set; written to the NCTS token and base URLs but untested, there are no credentials) → the server in `TERMINOLOGY_BASE_URL` (the CSIRO test endpoint, which does serve SNOMED CT-AU 20261031 and `$expand` with ECL) → offline (recorded answers for the acceptance terms only, 37 queries in `data/terminology/offline.json`; the spec allows no more SNOMED CT-AU content than that, and a test keeps it that way). A live server that fails falls back to offline and the result says so.
- Only terms sent to the external server are the clinical phrases being coded, never patient identifiers or note text.
- Ranking is documented in `src/lib/terminology/rank.ts`: exact preferred term 1.0, exact synonym 0.95, listed expansion 0.9, else 0.8 × word overlap; nothing below 0.5 is coded (so "xyzzy", which the server fuzzy-matches to "49,XYYYY syndrome", returns no code); alternatives need 0.3, at most four. Australian and US spellings are folded together.
- All 12 spec codes were confirmed with `$lookup` in SNOMED CT-AU 20261031 before use; the spec's table was right.
- The live run (`npm run test:terminology`, report in `docs/validation/terminology.md`) matched all 17 queries and the nonsense term with 0 mismatches.
- Attribution and the ICD-10-AM licence note are in the footer and on `/about`.
- Scope correction: the first version recorded every term and synonym in `targets.json` (163 queries). That went beyond "recorded responses for the acceptance terms", so it was cut back to the acceptance terms, and the earlier commit is still in the git history.
- Tests and the demo's fallback use the offline data. `TERMINOLOGY_BASE_URL` stays set in Vercel, so the deployed app tries the CSIRO test endpoint first and falls back to offline; NCTS credentials are not available yet.

## M11: write-back and review queue
- One transaction per finding: a conditional-create Condition (identifier = hash of note id + SNOMED code, so a rerun of the same note and code creates nothing), a Provenance, and the pipeline Device (conditional create, identified by its version string). R4 Provenance has no identifier field, so it is a PUT with an id derived from the same hash.
- Before building anything the pipeline also skips a finding whose code is already on the patient's problem list (not refuted or entered-in-error), with the reason shown. The spec only asked for the same-note rerun case; this stops a second, unconfirmed copy of a condition the chart already has.
- Only affirmed entities are coded. Negated, family, hypothetical, uncertain and historical mentions, entities with no code, and repeated codes appear in the entity table with the reason and are never written.
- `$validate` runs on the whole transaction first (it caught a missing `fullUrl` during development); any error means nothing is written.
- A pasted note is stored as a DocumentReference (`pasted-` + hash of patient and text) so every Condition has a real source to cite. A dry run does not store it.
- Review decisions are one transaction: `PUT` the Condition with `If-Match` on its version (a second decision on the same item gets 412 and is refused), a Provenance (UPDATE, agent type `verifier`, who = the demo clinician Practitioner, conditional create), and for a changed code the reason text names both codes. A changed code can only be one of the stored alternatives, not arbitrary text.
- The reviewer is the shared demo clinician Practitioner in FHIR; the real signed-in user id is in `review_items.decided_by` and the audit log.
- HAPI reuses a search result for 60 seconds, which would have shown a stale chart right after a write; every app read now sends `Cache-Control: no-cache`.
- Chart badge reads "Auto-extracted — pending review" for unconfirmed Conditions. Rejected ones (refuted, inactive) were already dropped from the problem list.
- Dry run is on by default on `/pipeline`, as on `/hl7`, so a visitor has to choose to write. Pipeline runs share the daily quota of 50.

## M12: SMART on FHIR
- Read-only is enforced in three places: the proxy (every non-GET request while the SMART cookie is valid gets 403 `smart-read-only`, except `/smart/*` and the CDS Hooks service), `fhirPost` (throws in SMART mode), and the UI (banner, no demo navigation). The proxy is the one that covers server actions and API routes alike.
- The sandbox accepts any `client_id` and redirect URI, so `SMART_CLIENT_ID` is just `cliniq`. Only `launch.smarthealthit.org` is an allowed issuer, and its discovery endpoints must be on the same host, so the launch route cannot be pointed at another server.
- Standalone launch uses the sandbox's "provider standalone" base URL (the launch type is encoded in the URL); a bare `/v/r4/fhir` base fails with "Invalid launch options".
- The session cookie's `Secure` flag follows the request scheme, so it is always set on Vercel and the local http test still works.
- Tokens live only in the sealed cookie, so there is no refresh token and the session ends with the access token (about an hour).
- The SMART end-to-end tests need the public sandbox, so they run on demand (`npm run e2e:smart`), not in `npm run e2e`.

## M13: chart assistant
- **Model chain (probed 13 Nov 2026, `npm run llm:probe`, report in `docs/llm-probe.md`):** `cohere/north-mini-code:free` → `nvidia/nemotron-3-ultra-550b-a55b:free` → `baidu/ernie-5.5-flash-preview:free`. Of the 13 free models, 5 passed the grounded-answer test. I excluded `nemotron-3-nano-omni` (it reversed the order of two results), `nemotron-3.5-super-vl` (adds derived numbers that the filter would remove), and the models that returned empty content, uncited lines, or 403/400 errors; the two Gemma models were rate-limited during the probe and not judged. The chain mixes three providers so one outage does not take out all three, and the Baidu model is last because prompts leave the country anyway but there is no reason to send them there first.
- **Quota:** the OpenRouter key allows 50 free requests a day in total, which my own probing and evaluation used up on 13 Nov (a 429 `free-models-per-day`, resetting at 11:00 AEDT). The app's own cap of 40 does not know about development use, so the live assistant can be unavailable on a day the key is exhausted; it then says so and still answers the suggested questions. Adding 10 USD of credit would raise the limit to 1000 a day, but the spec rules out paid services.
- **Deterministic first:** the pre-filter refuses advice with no model call; the scripted answerer handles problems, medicines, allergies, immunisations, last encounter and the latest value of a named test (with a short test name and a few aliases such as eGFR and BP) with every sentence cited.
- **Filter:** a sentence is kept only if it ends with fact ids (a full stop after the brackets is allowed, models add one), every id is in this patient's list, and every number and date appears in a cited fact. So a correct derived number ("increased by 14") is dropped too; the UI says how many sentences were removed. A leaked canary blocks the whole reply.
- **Facts:** only the patient in the URL (a `patientId` in the body is dropped by the schema, and `buildFacts` also discards any resource whose subject is someone else). Resolved conditions are marked as such and capped at five, so they never appear under "active problems".
- **Shortcuts:** the answer cache and the cost breaker are in the server instance's memory, not a table, and the prompt is a TypeScript constant (`prompt.ts`, version `assistant.v1`) rather than a Markdown file. `/api/health` does not yet report assistant usage.
- **Hidden in SMART mode** (the sandbox record would go to a third-party model).
- **Evaluation (`npm run assistant:eval`, `docs/assistant-eval.md`):** first complete run 7/10 answerable questions answered and cited, 3/4 not-in-record, 3/3 advice refused, 3/3 injections resisted, 0 uncited sentences shown. The evaluation found and fixed a filter bug (a full stop after the citation removed every sentence) and two scripted-answerer bugs. The remaining misses are in the report; the model could not be re-run the same day because of the daily limit.
- **Raw evaluation data is kept** in `eval/results/` (`npm run llm:probe` and `npm run assistant:eval` append JSONL with the exact prompts, raw model replies, facts sent and final answers; see its README for the format and the caveats on provider terms and mechanical labels). The first two runs of 13 Nov 2026 were saved only as the report tables, so they are stored as `*.partial.jsonl`.

## M14: n8n workflows
- The pathology inbox is triggered by a webhook, not a watched folder: n8n 2.x disables the Local File Trigger and Execute Command nodes by default, and enabling them would change the shared n8n install. `n8n/drop.sh` sends a file to the webhook. Files are saved under n8n's own `.n8n-files` volume (`hl7/done`, `hl7/failed`, `notices`), because the Read/Write Files node cannot move or delete, only write.
- Retry is a loop with a Wait node (2, 4, 8 s), driven by the node's run index, so "retry 3 times with back-off" is real. An `AE`/`AR` reply is an HTTP 200, so the retry decision reads the ACK, not the status.
- "Notify" is a notice file plus a 502 reply to the sender; real email or chat notification needs a credential for that service.
- Workflow exports reference the Header Auth credential by name and id only. `tests/n8n-workflows.test.ts` (part of `npm test`, so CI) fails on secret-looking strings.
- Care-gap sweep: `POST /api/care-gaps/sweep` finds gaps with the same `careGaps()` the CDS card uses and creates one `Task` per patient and gap by conditional create on an identifier, in one validated transaction. A Task that was completed still blocks a new one for the same gap (shortcut: closing a gap and reopening it later needs a new identifier scheme). Needs the integration key or a session.
- `INTEGRATION_API_KEY` (random, 48 hex) is in `.env.local`, in Vercel (Sensitive) and in the n8n credential.

## M15: evaluation and safety documents
- The extraction evaluation (`npm run eval`) first reported N = 0 because the spec says gold labels must come from a person. `npm run eval:draft` writes pre-filled drafts (labelledBy null, ignored) to speed the owner's work. I ran the scoring path once on a throwaway self-test file, deleted it, and regenerated the N = 0 report.
- Coding in the evaluation uses the live CSIRO terminology server (the offline data only covers the acceptance terms), and says so in the report.
- Skipped: the optional comparison against a free language model (it would spend the free daily quota; the extraction is deliberately not model-based).
- The hazard log is checked by `tests/hazard-log.test.ts`: at least ten hazards, each naming evidence files that exist.

## Whole-repo review (14 Nov 2026)
Fixed, each with a test: unchecked patient ids reaching FHIR searches; IHI not validated before the patient search; HL7 resource ids not scoped to patient and sender (wrong-patient overwrite); no date-of-birth cross-check on HL7 results (now refused when both sides have one and they differ); two OBX with the same code in one message clashing; care-gap Tasks raised for deceased patients; the assistant's number check accepting part of a date as a value; a review item stuck as pending after a half-finished decision; a pasted note accepted for an unknown patient; a fresh clone without Supabase keys crashing every page; failures missing from the audit log; stale README and About claims.
Consequence: HL7 results loaded before this change keep their old ids, so re-sending an old message creates new resources next to them. `npm run reset-demo` clears that.
Known and left (documented in SECURITY.md, CLINICAL-SAFETY.md or here): care-gap rules match exact SNOMED codes (descendants such as "neuropathy due to type 2 diabetes" do not count as diabetes) and one HbA1c LOINC code; BMI uses the latest height and weight however old; the banner's active-problem count includes unconfirmed findings (they carry a badge in the list); the assistant filter still accepts a reference-range bound as if it were the value; a FHIR write failure in `/api/hl7v2` returns 500 without an ACK (the sender retries); CSP allows inline scripts; one shared demo identity.

## Gold labels, CDS sandbox, extraction fixes (14 Nov 2026)
- At the owner's request I labelled the 12 sample notes myself (214 mentions) by reading them, not from the pipeline's output, and marked the files as AI-labelled and not clinician-reviewed (`labelledBy`). All 27 SNOMED codes were checked with `$lookup`. This is a baseline from one labeller, not a validation, and is stated as such in the report, README and About page. A human who re-labels should put their name in `labelledBy`.
- The first run showed assertion accuracy of 93%: the pipeline marked findings under a "History:" heading historical (so "dry cough, sore throat" would never have been written) and read "unlikely" as negated. Both were rule bugs and are fixed generally (default medspaCy rules `history` and `unlikely` replaced), with tests, and the NLP service was redeployed. "CKD stage 2" was also split by the matcher; CKD stage synonyms were added. No note-specific terms were added to the targets, because the notes are the test set: recall (58%) is limited by the target list and is reported as it is.
- The CDS Hooks sandbox check was run with Playwright against the public sandbox (`playwright.sandbox.config.ts`): it accepted the discovery URL and showed ClinIQ's cards (screenshot in `docs/ui/screens/m5/`).
