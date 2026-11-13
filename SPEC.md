# ClinIQ — Build Spec

> This file is the single source of truth for building ClinIQ. It is written so that one autonomous
> agent run can implement it end to end. Read `AGENTS.md` first (this Next.js version has breaking
> changes — read `node_modules/next/dist/docs/` for any API you touch), then this file, then
> `docs/PLAN.md` for context and `docs/history/` for the original plan and past debugging notes.

## 0. Rules for the implementer

- Work autonomously. Do not ask questions. When something is ambiguous, pick the option that a
  senior health-IT engineer would pick, and record it in `DECISIONS.md` (one line: decision + why).
- Implement in the tier order below. Every tier must leave the app working, building and deployable,
  so a partial run is still a coherent product. Commit at the end of each numbered item
  (conventional commits, e.g. `feat(chart): problem list split by clinicalStatus`).
- Never invent clinical values. Everything shown comes from FHIR data or from a documented,
  tested calculation. Anything AI-generated or auto-coded is visibly labelled and reviewable.
- Secrets live only in env vars and server-side code. Never in client bundles, never committed.
- **Zero-cost constraint.** The owner will not pay for anything. Everything must run on free tiers
  (Vercel Hobby, Supabase Free, Cloud Run free tier, free public sandboxes and terminology
  services). No paid API may be required for any feature to work. Keyed LLM providers may exist
  only as optional, off-by-default adapters. Do not add Cloud SQL, paid databases, or anything else
  that needs a paid plan.
- If a required env var / external service is missing, degrade gracefully (feature hidden behind a
  clear "not configured" state) instead of crashing — and say so in the final summary.
- Definition of done for the whole run: `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build` and `npm run test:e2e` all pass, and you have clicked through every main flow in a
  real browser. Finish with a summary: what was built, decisions, what is left, anything the owner
  must do by hand.

## 1. Product

**One-liner:** Unstructured clinical notes → extracted findings → coded to SNOMED CT / ICD-10 →
written back as FHIR resources with provenance → shown on an EHR-style patient chart alongside
vitals, labs, medications and allergy alerts.

**Audience:** healthcare IT engineers, clinical informaticians and hiring managers. They judge on
standards fluency (FHIR R4, SMART on FHIR, CDS Hooks, LOINC, SNOMED CT), safety and honesty, and
engineering quality — not on visual flash alone.

**Honest framing (must appear in README, footer and About page):** ClinIQ is a portfolio prototype
and coding-assistance demo. It uses synthetic data only (Synthea). It is not a medical device, not
clinically validated, and makes no claim of regulatory compliance. All auto-extracted and auto-coded
output is flagged for clinician review. Decision-support cards are informational demos.

## 2. Architecture

```
            ┌──────────────────────── Vercel (Next.js 16, App Router, TS strict) ─────────────────────────┐
 Browser ──▶│ UI (chart, review queue, pipeline)   Route handlers / server actions   /cds-services (CDS Hooks) │
            └──────┬──────────────────────────────┬───────────────────────┬─────────────────────┬─────────┘
                   │ FHIR R4 REST                  │ Anthropic API          │ FHIR terminology     │ Supabase
                   ▼                               ▼ (extraction, summary)  ▼ ($lookup/$expand)    ▼ (auth, audit,
        HAPI FHIR on Cloud Run  ◀─ or ─▶  SMART Health IT sandbox     NCTS Ontoserver / UMLS     pipeline runs, review)
        (ClinIQ's own data, writable)      (SMART launch, read-only)
```

- **FHIR is the system of record for clinical data.** Supabase holds only app data: users, audit
  log, pipeline runs, review decisions. Do not copy patient records into Supabase.
- The FHIR layer must work against **any** FHIR R4 server via `FHIR_BASE_URL`. Two data modes:
  - **Demo mode** (default): server-side reads/writes against ClinIQ's HAPI server. Login with
    Supabase Auth (seeded demo clinician account, credentials shown on the login page).
  - **SMART mode**: standalone launch and EHR launch from the public SMART Health IT sandbox
    (`https://launch.smarthealthit.org`), OAuth2 + PKCE, scopes `openid fhirUser launch
    launch/patient patient/*.read` (adjust for SMART v2 `patient/*.rs`). Read-only. Note-to-FHIR
    write-back is disabled in SMART mode with an explanatory message.
- In the diagram, the "Anthropic API" box is an **optional** LLM adapter, not a requirement. The
  default extraction path is free (see 2.2).
- HAPI on Cloud Run scales to zero; first request can take 30–120 s. Handle it: server-side
  caching of read requests (Next.js caching primitives — check the bundled docs), a "waking the FHIR
  server" state with retry instead of an error page, and a `/api/health` route.

## 3. Tiers and acceptance criteria

### Tier 0 — Foundation

0.1 **Typed FHIR data layer.** `src/lib/fhir/` with `@types/fhir` (R4). No `any` anywhere in `src`
    (enable `@typescript-eslint/no-explicit-any` as error). A small client (`fhirFetch`) with base
    URL from env, timeouts, retries for cold starts, typed errors, bundle paging (`link[next]`).
    Helpers for display of `HumanName`, `CodeableConcept`, `Quantity`, dates, age.
    *Done when:* existing pages use it, `npm run typecheck` passes with strict mode.
0.2 **Config.** `.env.example` documents every variable (see §5). A typed `env.ts` validates env at
    startup (zod) and exposes feature flags (`features.smart`, `features.ai`, `features.terminology`,
    `features.supabase`).
0.3 **Tooling.** Scripts: `typecheck`, `test` (Vitest), `test:e2e` (Playwright, with axe
    accessibility checks), `format`. GitHub Actions CI on push/PR: install, lint, typecheck, unit
    tests, build. (E2E in CI only against a mocked FHIR server/fixtures — no live services in CI.)
0.4 **Synthea loader.** `scripts/load-synthea.ts`: loads `hospitalInformation*` and
    `practitionerInformation*` bundles first, then patient bundles; idempotent; concurrency-limited;
    `--limit N` option; prints a pass/fail report. (Fixes `docs/history/ClinIQ_debug_history.md` #9.)
0.5 **Fixtures.** A small set of real Synthea resources committed under `tests/fixtures/` for unit
    and E2E tests, so tests never need the live server.

### Tier 1 — EHR-style chart (standards done properly)

1.1 **Patient list.** Server-side search by name and identifier (FHIR search params, not client
    filtering), sort, pagination via bundle links, columns: name, sex, age, DOB, MRN identifier,
    number of active problems. Loading, empty and error states.
1.2 **Patient banner** (sticky on the chart): name, age/sex, DOB, MRN, allergy alert chip (red,
    shows count + highest criticality; "No known allergies" only when an explicit NKA exists, else
    "Allergies not recorded"), active problem count.
1.3 **Problem list** split by `clinicalStatus` (active / resolved / other) with onset dates,
    `verificationStatus` shown, and SNOMED codes visible on hover/expand.
1.4 **Medications:** active `MedicationRequest`s (resolve `medicationReference` or use
    `medicationCodeableConcept`), dosage text, authored date. **Allergies** with criticality,
    reaction, category. **Immunisations.** **Encounters timeline** (newest first, type, class, date,
    reason).
1.5 **Vitals & labs.** Fetch observations by category (`vital-signs`, `laboratory`) with enough
    history for trends (page through results; do not stop at 20). Group by **LOINC code**, not by
    display text. Blood pressure: handle the panel `85354-9` with components `8480-6` (systolic)
    and `8462-4` (diastolic) as one combined chart. Show reference ranges from
    `Observation.referenceRange`; when absent, fall back to a small documented table of common LOINC
    reference ranges in `src/lib/clinical/reference-ranges.ts` labelled "illustrative adult range".
    Flag high/low (`interpretation` if present, else computed) with colour + text (not colour only).
1.6 **View FHIR JSON** on every record (drawer with pretty-printed JSON, copy button, link to the
    resource URL on the server).
1.7 **Export** the patient as a FHIR document: try `Patient/$summary` (International Patient
    Summary) if the server's CapabilityStatement supports it, otherwise assemble an IPS-shaped
    `Bundle` (type `document`, Composition with Problems / Medications / Allergies / Results /
    Immunisations sections) and download as JSON. Validate it with the server's `$validate` when
    available and show the OperationOutcome.

### Tier 2 — The pipeline: notes → codes → FHIR (headline feature)

2.1 **Notes source.** Read clinical notes from `DocumentReference` (Synthea exports notes there,
    base64 in `content.attachment.data`) for the patient, plus a "paste a note" box. Ship 10–20
    sample notes in `data/sample-notes/` (Synthea-generated; synthetic only).
2.2 **Extraction service** (`src/lib/pipeline/extract.ts`, server only). One `Extractor` interface with a
    zod-validated output schema and three engines chosen by `EXTRACTION_ENGINE`:
    (a) `rules` (default, free, deterministic): gazetteer matching built from the terminology source
    or a built-in list, plus NegEx/ConText-style rules for negation, hedging, historical and
    family-history assertions, aware of note sections (e.g. a "Family History:" heading);
    (b) `precomputed`: cached results keyed by the SHA-256 of the note text in `data/precomputed/`,
    which **you generate during this run by reading each sample note yourself and writing the
    extraction JSON** (no external API; label them "model-assisted, produced during development");
    (c) `llm` (optional, off by default): any OpenAI-compatible endpoint or Anthropic, via env, for
    people who bring their own key. The UI always shows which engine produced a result. Per finding: text span (start/end offsets into the note), type
    (diagnosis / symptom / procedure / medication / allergy), assertion (present / negated /
    possible / historical / family-history), and a short quote. Negation and family history must not
    become positive findings. Model name and prompt version are recorded.
2.3 **Coding service** (`src/lib/pipeline/code.ts`). For each finding, get candidate codes from a FHIR
    terminology server (`TERMINOLOGY_BASE_URL`; NCTS Ontoserver for SNOMED CT-AU, or UMLS if that is
    what is configured — implement behind one interface). Disambiguate using note context (rule
    scoring against candidate descriptions, then an optional LLM tie-break). Output: chosen code,
    display, system, alternatives, confidence 0–1 and a one-line rationale. Map SNOMED → ICD-10
    (ICD-10-AM if available, else ICD-10 via the terminology server's ConceptMap `$translate` when
    supported) and say when no map exists. If no terminology server is configured, fall back to a
    clearly labelled offline mode with a small built-in code list so the demo still runs.
2.4 **Write-back as proper FHIR** (demo mode only). For accepted-for-review findings create
    `Condition` resources with `verificationStatus = unconfirmed`, `category =
    encounter-diagnosis`, `evidence.detail` → the source `DocumentReference`, plus a `Provenance`
    resource (agent = ClinIQ extraction pipeline as a `Device`, entity = the note, recorded time,
    model + prompt version in an extension or `Provenance.reason`). Run `$validate` before writing;
    refuse to write on validation errors and show the OperationOutcome. Use a `transaction` Bundle.
2.5 **Review queue.** `/review`: each auto-coded finding with note excerpt highlighted, chosen code,
    alternatives, confidence, rationale. Actions: confirm (→ `verificationStatus = confirmed`),
    change code, reject (→ `refuted` or `entered-in-error`). Every action recorded in Supabase and
    reflected in FHIR. On the chart, unconfirmed AI-derived conditions show an "Auto-extracted —
    pending review" badge.
2.6 **Pipeline view.** `/pipeline`: pick a patient + note (or paste) → watch the stages (extract →
    code → validate → write) with timings and intermediate JSON, then a link to the result on the
    chart. This is the demo flow.
2.7 **Evaluation harness.** `npm run eval -- --engine rules|precomputed|llm`: runs extraction + coding over `eval/gold/*.json` (note
    text + expected findings and codes) and reports precision / recall / F1 per stage and per
    assertion type into `eval/REPORT.md`. Commit the harness, the schema and **three** example gold
    files clearly marked `"labelledBy": "example — replace with human labels"`. Do not fabricate a
    full gold set; the owner will hand-label it.

### Tier 3 — Standards that health IT people look for

3.1 **SMART on FHIR** (see §2). `/launch` (EHR launch) and `/smart` (standalone launch picker) using
    the `fhirclient` library or a hand-rolled PKCE flow. After launch, the same chart UI renders the
    sandbox patient. README explains how to launch from `https://launch.smarthealthit.org`.
3.2 **CDS Hooks service, for real.** Implement the spec's endpoints in this app:
    `GET /cds-services` (discovery) and `POST /cds-services/cliniq-patient-view` (`patient-view`
    hook, with `prefetch` templates for Patient, Conditions, recent Observations). It returns cards:
    - BMI with category (from latest height `8302-2` and weight `29463-7`, or BMI `39156-5`).
    - eGFR using **CKD-EPI 2021 (race-free)** from latest serum creatinine (`2160-0`), age and sex,
      with CKD stage.
    - Care gaps, e.g. diabetes (SNOMED `44054006` and descendants where checkable) with no HbA1c
      (`4548-4`) in 12 months; hypertension with no BP in 12 months.
    Cards follow the CDS Hooks card schema (summary, indicator, detail, source). The chart calls the
    service and renders the cards. Must be usable from the public CDS Hooks sandbox
    (`https://sandbox.cds-hooks.org`) — document how; add permissive CORS on `/cds-services` only.
    **Unit tests for every calculator with published reference values**, including edge cases
    (missing data, units in mg/dL vs µmol/L, paediatric age → not calculated).
3.3 **Supabase:** auth (email + password; seeded demo account), and tables with RLS on every table:
    `audit_events` (shaped like FHIR AuditEvent: who, what resource, action, when, outcome, source
    IP hash), `pipeline_runs`, `review_decisions`. Every chart view, export, write-back and review
    action writes an audit event. `/audit` page lists them (filter by user/patient/action).
    Migrations in `supabase/migrations/`.
3.4 **Security basics:** security headers (CSP, frame-ancestors, referrer-policy), server-only
    modules for secrets (`import "server-only"`), input validation on every route handler, rate limit
    on pipeline + AI routes, no PHI-like data in logs. `docs/SECURITY.md` with a short threat model.

### Tier 4 — AI summary, polish, proof

4.1 **Grounded patient summary.** Default is deterministic and template-built (no LLM, free). An
    LLM-written narrative is optional behind `features.ai` (bring-your-own key, off by default). In
    both modes every sentence cites the FHIR resources it came from
    (clickable chips opening the FHIR JSON drawer). If a sentence cannot be grounded, it is dropped.
    Banner: "AI-generated, may be wrong, verify against the record."
4.2 **Design system.** Calm clinical UI: consistent spacing/typography, light + dark mode, dense but
    readable tables, keyboard navigable, WCAG 2.2 AA (axe in Playwright passes on main pages),
    responsive down to tablet. Skeleton loading states.
4.3 **About / case-study page** (`/about`): problem, architecture diagram, standards used, the
    pipeline, evaluation results (read from `eval/REPORT.md`), limitations, honest framing.
4.4 **Docs.** README: one-paragraph pitch, live demo link placeholder, screenshots placeholders
    (`docs/screenshots/`), Mermaid architecture diagram, standards list, setup (local + deploy), env
    vars, how to launch via SMART sandbox and CDS Hooks sandbox, testing, limitations and the honest
    framing. ADRs in `docs/adr/` (FHIR as system of record; HAPI on Cloud Run; Supabase for app
    data only; terminology source; LLM extraction with human review; CDS Hooks as a real service).
    `CHANGELOG.md`.

## 4. Non-goals

No real patient data, ever. No HL7 v2 / CDA. No mobile app. No billing. No claims of clinical
validity. Don't replace HAPI FHIR or move clinical data into Supabase.

## 5. Environment variables

| Variable | Used for | Required |
|---|---|---|
| `FHIR_BASE_URL` | ClinIQ HAPI FHIR R4 base (demo mode) | yes |
| `SMART_CLIENT_ID` | SMART launch client id (sandbox accepts any) | for SMART |
| `SMART_REDIRECT_URI` | SMART redirect | for SMART |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase auth client | for auth/audit |
| `SUPABASE_SECRET_KEY` | server-side writes (audit) | for auth/audit |
| `EXTRACTION_ENGINE` | `rules` (default), `precomputed` or `llm` | no |
| `LLM_PROVIDER` / `LLM_API_KEY` / `LLM_MODEL` | optional bring-your-own-key LLM adapter | no (off by default) |
| `TERMINOLOGY_BASE_URL` / `TERMINOLOGY_CLIENT_ID` / `TERMINOLOGY_CLIENT_SECRET` | NCTS Ontoserver (OAuth client credentials) | for coding |
| `UMLS_API_KEY` | alternative terminology source | optional |

## 6. Reference codes (LOINC unless stated)

BP panel `85354-9` · systolic `8480-6` · diastolic `8462-4` · heart rate `8867-4` · resp rate
`9279-1` · temp `8310-5` · SpO2 `59408-5` · height `8302-2` · weight `29463-7` · BMI `39156-5` ·
creatinine `2160-0` · HbA1c `4548-4` · glucose `2339-0` · total cholesterol `2093-3` · LDL `18262-6`
· HDL `2085-9` · diabetes SNOMED `44054006` · hypertension SNOMED `38341003`.

## 7. Cost

Target: $0 per month. Vercel Hobby, Supabase Free (500 MB; keep HAPI data to roughly 25-40
patients), Cloud Run free tier with `min-instances=0`, free NCTS/UMLS terminology access, free
public SMART and CDS Hooks sandboxes. Never add Cloud SQL. Document in the README that the live
demo may take up to two minutes to wake.
