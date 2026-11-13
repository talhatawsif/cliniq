# ClinIQ — Build Spec (v2, milestone cards)

> Single source of truth for building ClinIQ. Read `AGENTS.md` first (this Next.js version has
> breaking changes — read `node_modules/next/dist/docs/` for any API you touch), then this file,
> then `docs/PLAN.md` (context, decisions, owner to-dos) and `docs/history/` (old notes).
>
> **How this is meant to be built:** Opus plans (done: this file). Sonnet builds **one milestone per
> session** (§4). Each card has a "Done when" check; do not start the next card until it passes.
> Claude Fable is reserved for at most two jobs (§9). Every milestone leaves the app building,
> deployable and honest, so stopping at any point still gives a coherent product.

## 0. Rules for the implementer

- Work milestone by milestone. Pick the option a senior health-IT engineer would pick and record it
  in `DECISIONS.md` (one line: decision + why). Ask the owner only for things only he can do
  (accounts, keys, approvals) — list them at the end of the session.
- Conventional commits, one per numbered item. Do not push; the owner pushes.
- Never invent clinical values. Everything shown comes from FHIR data or from a documented, tested
  calculation. Anything auto-extracted, auto-coded or AI-written is labelled and reviewable.
- Secrets only in env vars and server-side code. Never in client bundles, never committed. Never
  print a key in logs, chat or docs.
- **Zero-cost constraint.** The owner will not pay for anything (one exception: up to ~$1 may be
  spent on the Python NLP service if free tier proves insufficient). No paid API may be required for
  any feature to work. See §8 for the allowed services.
- **LLM rule (hard):** the only hosted LLM models allowed are OpenRouter models whose id ends in
  `:free`, plus Cloudflare Workers AI free-tier models as fallback. The LLM client must refuse to
  call any OpenRouter model id that does not match `/:free$/` (unit-tested), and must never send a
  request that could spend credits. Never use paid or Anthropic API keys in the app.
- Missing env var / service → degrade gracefully ("not configured" state) rather than crash, and say
  so in the session summary.
- Synthetic data only. No real patient data, ever.
- Definition of done per milestone: `npm run lint`, `typecheck`, `test`, `build` pass (plus
  `test:e2e` once it exists) and the card's "Done when" is verified in a real browser.

## 1. Product

**Problem it solves.** In Australian health services a lot of clinical meaning sits in free-text
notes, while analytics, registers, referrals and decision support need coded, structured data
(SNOMED CT-AU, ICD-10-AM, FHIR). Coding by hand is slow and inconsistent; labs and legacy systems
still speak HL7 v2. ClinIQ shows an end-to-end, standards-based way to bridge that gap safely: notes
and HL7 v2 messages in → coded, validated FHIR out → clinician review → EHR-style chart with
decision support. It is a **coding-assistance and interoperability prototype**, not a diagnostic
tool.

**Pitch (to clinicians / coders / health-IT):** "Faster, more consistent coding from notes with a
human always in the loop; every auto-coded item carries provenance and a confidence, and nothing is
final until a clinician confirms it."

**Audience:** healthcare IT engineers, clinical informaticians, hiring managers (Australia first).
They judge on standards fluency (FHIR R4, AU Core, SMART, CDS Hooks, LOINC, SNOMED CT-AU, HL7 v2),
safety, honesty and engineering quality.

**Honest framing (README, footer, About page):** portfolio prototype; synthetic data only; not a
medical device; not clinically validated; no regulatory claim. Includes a "Path to production"
section (TGA software-as-medical-device considerations, HIMAA guidance on AI-assisted clinical
coding, privacy under the Privacy Act / My Health Records, terminology licensing, clinical safety
review). Decision-support cards are informational demos.

## 2. Architecture

```
 Browser ──▶ Vercel (Next.js 16, TS strict): UI · route handlers · /cds-services · chart assistant
                │             │                   │                    │
                │ FHIR R4     │ HTTPS             │ FHIR terminology   │ Postgres (RLS)
                ▼             ▼                   ▼                    ▼
        HAPI FHIR on     NLP service          NCTS Ontoserver     Supabase (project "cliniq",
        Cloud Run  ◀──── (Python, Cloud Run)  (SNOMED CT-AU)      Sydney): app data + HAPI's DB
           ▲  ▲                                                     in a separate schema
           │  └── n8n on the owner's Mac (demo-time): HL7 v2 → FHIR, note pipeline trigger,
           │      care-gap sweep, error alerts   (exported workflow JSON committed in repo)
           └── GitHub Actions: keep-alive pings (Supabase + Cloud Run warm-up), CI
 LLM chain (assistant/summary only): OpenRouter ":free" → Cloudflare Workers AI → scripted fallback
```

- **FHIR is the system of record for clinical data.** Supabase holds app data (users, audit, pipeline
  runs, review decisions) and, in a separate schema, HAPI's own tables. Do not copy patient records
  into app tables.
- The FHIR layer works against any FHIR R4 server via `FHIR_BASE_URL`. Modes: **Demo** (default;
  ClinIQ's HAPI, writable, Supabase Auth with seeded demo clinician) and **SMART** (launch from
  `launch.smarthealthit.org`, read-only, PKCE).
- Cloud Run scales to zero (`min-instances=0`, `max-instances=1`). Cold start can take 30–120 s:
  cache reads, show a "waking the FHIR server" state with retry, expose `/api/health`.
- n8n runs on the owner's Mac for demos only; the app must work fully without n8n (n8n features are
  additive and the UI shows "n8n offline" when unreachable).

## 3. Data plan

- **Cohort: ~20 curated Synthea patients** (not the full 109), all with notes, chosen for variety:
  CKD + hypertension (Sherwood, Patricio), diabetes/hypertension/lipids (Celesta, Ghislaine, Daina,
  Micaela, Sung), polypharmacy (Ezra), elderly women (Cameron, Tandra), many allergies (Twila, Luke,
  Whitley), young adults / paediatric (Claudio, Suzan, Brittny, Clemente), a deceased patient
  (Duncan), plus Lita and Carlo. Exact IDs come from `scripts/select-cohort.ts`.
- **Trim before load** (`scripts/trim-synthea.ts`): drop `Claim` and `ExplanationOfBenefit` (US
  billing, ~46 % of volume), drop unused types, cap history (`exporter.years_of_history`/filter to
  the last 3–5 years), cap very heavy patients' Observations. Target ≤ ~1.3 MB per patient → ~200 MB
  in Postgres (HAPI expands input ~7×). Hospital/practitioner files load first.
- **Budget:** keep the whole DB ≤ ~350 MB of the 500 MB Supabase free limit; log DB size in the load
  report.
- **Australianisation layer** (`scripts/australianise.ts`): add AU Core-shaped identifiers where
  cheap (IHI-like synthetic identifier, Medicare-number-shaped synthetic identifier, AU address
  states) and map terminology to SNOMED CT-AU/AMT where available. All clearly synthetic.
- **CSIRO "Australian synthetic healthcare data" (Synthea, Queensland):** evaluate as the preferred
  source only if (a) its licence permits redistribution/demo use (listing is ambiguous: CC BY 4.0 vs
  "All Rights CSIRO"), and (b) it is FHIR with usable profiles. Do not commit CSIRO data to the
  public repo; load locally only. Default path stays Synthea + australianise script.
- **Notes:** Synthea notes live in `DocumentReference`. Also ship 10–20 hand-checked sample notes in
  `data/sample-notes/` and 5 sample HL7 v2 ORU^R01 messages in `data/hl7v2/` (synthetic).

## 4. Milestone cards

Each card = one focused Sonnet session. "Needs" lists owner actions or earlier cards.

### M0 — Foundation
- Typed FHIR layer in `src/lib/fhir/` with `@types/fhir`; no `any` (ESLint error); `fhirFetch` with
  timeouts, cold-start retries, typed errors, bundle paging; display helpers (names, codings,
  quantities, dates, age).
- `env.ts` (zod) + feature flags (`smart`, `ai`, `terminology`, `supabase`, `nlp`, `n8n`).
- Scripts: `typecheck`, `test` (Vitest), `test:e2e` (Playwright + axe), `format`. GitHub Actions CI
  (lint, typecheck, unit, build; e2e against fixtures only). `DECISIONS.md` created.
- `tests/fixtures/`: small real Synthea resources for tests.
- **Done when:** existing pages use the typed layer; all scripts pass; CI file is valid.

### M1 — Data & persistent FHIR server  *(Needs: Supabase project `cliniq`, DB password from owner)*
- `scripts/select-cohort.ts`, `trim-synthea.ts`, `australianise.ts`, `load-synthea.ts` (order:
  hospitals → practitioners → patients; idempotent; concurrency-limited; `--limit`; pass/fail report
  incl. DB size).
- Cloud Run HAPI config pointing at Supabase Postgres via the **session pooler** (separate `hapi`
  schema; Postgres dialect). Document the exact `gcloud run deploy` command in
  `docs/DEPLOY.md`; `min-instances=0`, `max-instances=1`; budget alert $1.
- **Done when:** ~20 patients survive a Cloud Run scale-to-zero; the app lists them from the cloud
  URL; DB size < 350 MB.

### M2 — EHR-style chart
Server-side patient search (name, identifier) with paging; sticky banner (allergy chip with
criticality, "Allergies not recorded" vs explicit NKA, active problem count); problem list split by
`clinicalStatus` with `verificationStatus`; active medications (resolve `medicationReference`);
allergies; immunisations; encounter timeline; loading/empty/error states.
**Done when:** every section renders for 3 different cohort patients; e2e smoke passes.

### M3 — Labs, vitals, FHIR JSON
Observations by category with full paging; group by **LOINC code**; BP panel `85354-9` with
components as one chart; reference ranges from the resource, else a documented illustrative table;
high/low flags with text + colour; "View FHIR JSON" drawer on every record; Patient export (IPS-shaped
document Bundle, `$validate` result shown).
**Done when:** BP and a lab trend render correctly for a known patient; JSON drawer works everywhere.

### M4 — CDS Hooks service
`GET /cds-services`, `POST /cds-services/cliniq-patient-view` with prefetch; cards for BMI category,
eGFR (CKD-EPI 2021 race-free, with CKD stage), and care gaps (diabetes without HbA1c in 12 months,
hypertension without BP in 12 months). Permissive CORS on `/cds-services` only; works from
`sandbox.cds-hooks.org`. **Unit tests with published reference values for every calculator**
(mg/dL vs µmol/L, missing data, paediatric → not calculated).
**Done when:** unit tests pass; the chart shows cards; documented sandbox test succeeds.

### M5 — Auth, audit, security  *(Needs: Supabase keys)*
Supabase Auth (seeded demo clinician shown on the login page); RLS on every table: `audit_events`
(AuditEvent-shaped), `pipeline_runs`, `review_decisions`; migrations in `supabase/migrations/`;
audit on view/export/write/review; `/audit` page with filters; security headers (CSP,
frame-ancestors, referrer-policy), `server-only` for secrets, zod on every route handler, rate
limits, no PHI-like data in logs; `docs/SECURITY.md` (short threat model).
**Done when:** logging in is required for demo mode; an audit row appears for each action; RLS
verified with the Supabase advisor (no warnings).

### M6 — NLP service (Python, Cloud Run, free tier)
`services/nlp/` — FastAPI container: **medspaCy** (sectionizer + ConText for negation / hypothetical
/ family history / historical), **scispaCy** entity recognition (small model; must fit the free-tier
memory limit), **SapBERT** embeddings for candidate reranking (small, CPU, loaded lazily).
`POST /extract` (zod-mirrored JSON schema: spans, type, assertion) and `POST /rerank`. Container
size and cold-start measured and recorded; `max-instances=1`. If it does not fit the free tier, fall
back to rules engine in TS (`EXTRACTION_ENGINE=rules`) and record in DECISIONS.md. Engines:
`rules` (TS, default fallback) · `medspacy` (this service) · `precomputed` (cached JSON) · `llm`
(`:free` only).
**Done when:** negation/family-history test notes produce correct assertions; the service answers
from Cloud Run after scale-to-zero.

### M7 — Coding with the Australian terminology service  *(Needs: NCTS access, or UMLS; else offline list)*
Terminology client behind one interface (`NCTS Ontoserver` OAuth2 client-credentials; `UMLS`
alternative; **offline fallback** with a small built-in SNOMED/ICD-10 subset clearly labelled).
Candidate generation by `$expand` filter / `$lookup`, rerank with SapBERT (M6) plus context rules,
output: code, display, system, alternatives, confidence 0–1, rationale. SNOMED → ICD-10-AM via
ConceptMap `$translate` where supported, else say "no map". Attribution text for SNOMED CT-AU shown
in UI/About.
**Done when:** 10 sample notes are coded; offline mode works with no credentials.

### M8 — Write-back and review queue
Create `Condition` (`verificationStatus=unconfirmed`, `category=encounter-diagnosis`,
`evidence.detail` → source `DocumentReference`) + `Provenance` (agent = pipeline `Device`, entity =
note, engine + model + prompt version) via a `transaction` Bundle; `$validate` first (refuse on
errors, show OperationOutcome). `/review`: highlighted excerpt, chosen code, alternatives,
confidence, rationale; confirm / change code / reject (→ `refuted` / `entered-in-error`), recorded in
Supabase and FHIR. Chart shows "Auto-extracted — pending review". `/pipeline`: pick patient+note or
paste → watch extract → code → validate → write with timings and JSON.
**Done when:** paste note → unconfirmed Condition in FHIR → confirmed in review → shown on chart.

### M9 — n8n workflows  *(Needs: n8n running on the Mac; n8n MCP connected to Claude Code)*
Build and export (JSON under `n8n/workflows/`, screenshots/diagrams under `docs/n8n/`):
1. **HL7 v2 → FHIR:** webhook/file input of ORU^R01 → parse → map OBX to `Observation` (LOINC) and
   group into `DiagnosticReport` → `$validate` → POST to HAPI → error branch (dead-letter to
   Supabase table + alert).
2. **Note pipeline trigger:** new `DocumentReference` (poll or FHIR Subscription) → call the ClinIQ
   pipeline API → writes unconfirmed findings.
3. **Weekly care-gap sweep:** search patients with diabetes/hypertension lacking recent HbA1c/BP →
   create FHIR `Task` ("review care gap") per patient.
4. **Error-alert workflow** (global error trigger) → email/log.
Use n8n AI-Agent nodes only for tasks that benefit (e.g. summarising a sweep), `:free` models only.
Secure webhooks with a shared secret; no secrets in exported JSON (use credential references).
**Done when:** a sample HL7 v2 file turns into Observations visible on the chart; the sweep creates
Tasks; exports are committed with README.

### M10 — SMART on FHIR
Standalone + EHR launch against `launch.smarthealthit.org`, PKCE, scopes `openid fhirUser launch
launch/patient patient/*.rs` (v2; fall back to `.read`); same chart UI; write-back disabled in
SMART mode with an explanation; README launch instructions.
**Done when:** launching from the sandbox opens the sandbox patient in the chart.

### M11 — AU Core & AU Patient Summary
Validate the cohort and exported documents against **AU Core 2.0.0** (via `$validate` with the IG
loaded in HAPI, or the HL7 validator CLI in CI where feasible); report conformance honestly (what
passes, what is synthetic-only). Export an **AU Patient Summary**-style Bundle (and IPS via
`$summary` if supported). Use HL7 AU test data (`hl7au/au-fhir-test-data`) as reference examples.
**Done when:** a validation report is committed (`docs/validation/`) and the export downloads.

### M12 — Chart assistant (AI agent with guardrails)
In-app assistant answering questions about the open patient **only from FHIR data**, with the LLM
chain (OpenRouter `:free` → Cloudflare Workers AI → scripted fallback). Architecture: the model
gets read-only tools (`getConditions`, `getObservations`, `getMedications`, …) backed by the typed
FHIR layer, scoped to the current patient; every answer sentence cites resource chips (open the JSON
drawer); ungrounded sentences are dropped; refuses diagnosis/treatment advice and out-of-scope
questions; banner "AI-generated — verify against the record". Guardrails and tests: prompt-injection
text inside notes must not change behaviour; patient scope cannot be widened by the user; rate
limits; no PHI-like data in logs; model id allow-list enforced (`/:free$/`). Optional: expose the
same tools as an MCP server in `services/mcp/` for demo.
**Done when:** injection test notes fail to hijack the agent; answers show citations; with all LLMs
unreachable the scripted fallback still answers basic questions.

### M13 — Evaluation & model comparison
`npm run eval -- --engine rules|medspacy|precomputed|llm`: precision/recall/F1 per stage and per
assertion type over `eval/gold/*.json`; commit harness, schema and three example gold files marked
`"labelledBy": "example — replace with human labels"`; side-by-side comparison table in
`eval/REPORT.md` (rules vs medspaCy vs `:free` LLM; MedGemma 1.5 4B only as an optional offline
benchmark if the owner runs it — never in the live app). Do not fabricate a gold set.
**Done when:** `eval/REPORT.md` is generated from real runs.

### M14 — Polish, docs, proof
Design system (calm clinical, light/dark, keyboard navigable, WCAG 2.2 AA with axe passing on main
pages, tablet responsive, skeletons); grounded template-built patient summary (default) with
optional LLM narrative; `/about` case study (problem, architecture, standards, pipeline, eval,
limitations, Path to production); README (pitch, architecture Mermaid, standards list, setup,
sandbox instructions, honest framing, screenshots placeholders); ADRs in `docs/adr/` (FHIR as system
of record; HAPI on Cloud Run + Supabase Postgres; separate NLP service; NCTS terminology; n8n
integration layer; `:free`-only LLM policy; CDS Hooks as a real service); `CHANGELOG.md`.
**Done when:** axe passes; README renders; ADRs exist.

### M15 — Keep-alive & deploy
`.github/workflows/keepalive.yml` (scheduled; pings Supabase REST + Cloud Run `/fhir/metadata` and
NLP `/health` — **keep Supabase active, runs well within free Actions minutes**); Vercel deploy with
env vars; live smoke test including cold start; README live link.
**Done when:** the Action runs green; live demo works end to end.

## 5. Non-goals

No real patient data. No CDA. No mobile app. No billing/claims. No claims of clinical validity or
TGA/regulatory approval. Do not replace HAPI or move clinical data into app tables. No paid services.

## 6. Environment variables

| Variable | Used for | Required |
|---|---|---|
| `FHIR_BASE_URL` | HAPI FHIR R4 base (demo mode) | yes |
| `SMART_CLIENT_ID`, `SMART_REDIRECT_URI` | SMART launch | for SMART |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase auth client | auth/audit |
| `SUPABASE_SECRET_KEY` | server-side writes | auth/audit |
| `NLP_SERVICE_URL` | Python NLP service | for medspaCy engine |
| `EXTRACTION_ENGINE` | `rules` / `medspacy` / `precomputed` / `llm` | no (default `rules`) |
| `OPENROUTER_API_KEY` | free-model LLM access (assistant) | no |
| `OPENROUTER_MODELS` | comma list of allowed model ids; **each must end in `:free`** | no |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Workers AI fallback | no |
| `TERMINOLOGY_BASE_URL`, `TERMINOLOGY_CLIENT_ID`, `TERMINOLOGY_CLIENT_SECRET` | NCTS Ontoserver | for coding |
| `UMLS_API_KEY` | alternative terminology source | optional |
| `N8N_BASE_URL`, `N8N_WEBHOOK_SECRET` | n8n integration | optional |

## 7. Reference codes (LOINC unless stated)

BP panel `85354-9` · systolic `8480-6` · diastolic `8462-4` · heart rate `8867-4` · resp rate
`9279-1` · temp `8310-5` · SpO2 `59408-5` · height `8302-2` · weight `29463-7` · BMI `39156-5` ·
creatinine `2160-0` · HbA1c `4548-4` · glucose `2339-0` · total cholesterol `2093-3` · LDL `18262-6`
· HDL `2085-9` · diabetes SNOMED `44054006` · hypertension SNOMED `38341003`.

## 8. Cost — target $0/month

Allowed: Vercel Hobby (non-commercial), Supabase Free (500 MB DB, pauses after 7 days idle → keep-
alive Action), Cloud Run free tier (`min-instances=0`, `max-instances=1`, $1 budget alert; never
Cloud SQL), GitHub Actions (free scheduled workflows), n8n Community self-hosted on the Mac,
Cloudflare Workers AI free allowance (10,000 neurons/day), OpenRouter `:free` models (20 req/min,
50 req/day on accounts with < $10 lifetime purchases), free public SMART / CDS Hooks sandboxes,
NCTS/UMLS free access. Not allowed: any paid API, Hugging Face paid inference, Cloud SQL.
README must say the live demo may take up to two minutes to wake.

## 9. Model usage plan

- **Opus:** planning and this spec.
- **Sonnet:** every milestone above, one session each.
- **Claude Fable (max 2 uses):** (1) M7/M13 coding-and-evaluation engine **only if** Sonnet's
  disambiguation quality is clearly insufficient on the eval set; (2) a final end-to-end
  debugging/hardening pass. Anything else stays with Sonnet.
