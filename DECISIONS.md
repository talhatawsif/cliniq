# Decisions

One entry per decision: what changed and why. Newest section first. Implementers add one line per
decision made during a milestone.

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
