# ClinIQ — Plan

Human-readable plan: where the project stands, decisions made, what the owner does by hand, and
the build order. The build spec (milestone cards) is [`../SPEC.md`](../SPEC.md). Original notes are
in [`history/`](history/).

## Where it stands (13 Nov 2026)

- **Phase 1 dashboard shell works locally** (patient list, detail, vitals charts), commit `ace6803`.
- **Local HAPI FHIR** in Docker with Synthea data (109 patient files in `~/synthea/output/fhir/`).
- **HAPI on Cloud Run** (`cliniq-fhir-702838448237.us-central1.run.app`, project `cliniq-507000`)
  is up but held **0 patients** (built-in DB is lost on scale-to-zero). Fix: Postgres on Supabase.
- **New Supabase project `cliniq`** created in Sydney (ap-southeast-2), id `jzrmearcbiuqjbtsecfn`.
- **Planning done** (this repo): spec, plan, decisions below. **No feature code yet.**

## Decisions (agreed with the owner)

| Topic | Decision |
|---|---|
| Money | $0. At most ~$1 for the Python NLP service if the free tier can't host it. |
| Build tools | Opus plans, Sonnet builds one milestone per session, Fable ≤ 2 uses (SPEC §9). |
| Clinical data | FHIR (HAPI) is the system of record; Supabase = app data + HAPI's Postgres. |
| Cohort | ~20 curated Synthea patients, trimmed (no Claim/EOB, shorter history) to fit Supabase free. |
| Australian focus | AU Core 2.0.0 validation, AU Patient Summary export, NCTS (SNOMED CT-AU), synthetic AU identifiers. CSIRO data only if its licence allows. |
| NLP | Not on the 8 GB laptop. Small single-purpose models in a Python service on Cloud Run (medspaCy + scispaCy + SapBERT); rules engine as fallback; MedGemma only as offline benchmark. |
| LLM | OpenRouter **`:free` models only** (code-enforced) → Cloudflare Workers AI → scripted fallback. No paid keys. |
| n8n | Self-hosted on the owner's Mac for demos: HL7 v2 → FHIR, note-pipeline trigger, weekly care-gap sweep (FHIR `Task`), error alerts. Exported JSON in repo. |
| In-app AI | Chart assistant with FHIR tools, citations, injection tests, patient-scope guardrails. |
| Keep-alive | Scheduled GitHub Action pings Supabase + Cloud Run. |

## What it solves (pitch)

Clinical meaning sits in free text and HL7 v2 messages while registries, analytics and decision
support need coded, structured data. ClinIQ turns notes and lab messages into coded, validated FHIR
with provenance, puts a clinician in the loop, and shows the result on an EHR-style chart with
decision support. Coding-assistance and interoperability prototype — not diagnostic; synthetic data
only. For clinicians/coders: faster, more consistent coding with confidence and provenance. For
IT: standards-based, testable, auditable.

## Owner to-do list (only things Claude can't do)

- [ ] `git push` after each session (sandbox pushes are blocked).
- [ ] **NCTS:** send the drafted email (in Gmail) and register at the NCTS portal; paste credentials
      into `.env.local` only. UMLS licence is the fallback.
- [ ] **OpenRouter:** create an API key, put it in `.env.local` as `OPENROUTER_API_KEY` (the one
      shared in chat should be revoked/rotated once the project is public-facing). Only `:free`
      models are used.
- [ ] **Supabase:** DB password for project `cliniq` (for HAPI's connection string, via env only).
- [ ] **Google Cloud:** $1 budget alert on `cliniq-507000`; keep `min-instances=0`.
- [ ] **Vercel:** authorize team access, create the project from the GitHub repo.
- [ ] **n8n:** run it on the Mac (Docker or `npx n8n`) before M9 and before demos.
- [ ] **CSIRO data (optional):** confirm licence at data.csiro.au/collection/csiro:61499 before use.
- [ ] Later: hand-label the eval gold set (20–30 notes); screenshots, demo video, blog post.

## Build order

M0 Foundation → M1 Data & persistent FHIR → M2 Chart → M3 Labs/JSON → M4 CDS Hooks → M5 Auth/audit
→ M6 NLP service → M7 Coding (NCTS) → M8 Write-back & review → M9 n8n → M10 SMART → M11 AU Core →
M12 Chart assistant → M13 Eval → M14 Polish/docs → M15 Keep-alive & deploy.

Stopping points that are already a good portfolio piece: after M4 (standards-rich chart), after M8
(full pipeline), after M12 (with AI agent). Each session prompt for Sonnet:

```
Read AGENTS.md, SPEC.md (§0 rules + card M<n>) and docs/PLAN.md. Implement card M<n> only. Log
decisions in DECISIONS.md. Make its "Done when" true, verify in a browser, commit in small steps,
do not push. End with: what was built, decisions, what I must do by hand.
```

## Risks and how they are handled

- **Cloud Run cold start (30–120 s):** caching, wake-up UI, keep-alive Action, `/api/health`.
- **Supabase 500 MB / pause:** trimmed 20-patient cohort, size reported at load, keep-alive.
- **Free LLM limits (50 req/day) or outages:** fallback chain ends in a scripted answerer; core
  pipeline does not depend on an LLM.
- **NCTS access uncertain for students:** offline code subset keeps the demo working; UMLS fallback.
- **NLP service too big for free tier:** rules engine fallback; ≤ ~$1 option.
- **Licences:** SNOMED CT-AU attribution; CSIRO data not committed; Synthea is Apache 2.0.
- **Safety:** unconfirmed-by-default writes, provenance, review queue, honest framing, Path to
  production section.

## Interview talking points

- Why FHIR stays the system of record and Supabase only holds app data.
- How negation/family history stay out of positive findings (ConText).
- How a code is chosen among several SNOMED matches, and what confidence means.
- Why auto-coded conditions are `unconfirmed` until confirmed, and what Provenance adds.
- CDS Hooks as a service; the CKD-EPI 2021 calculation and its tests.
- HL7 v2 → FHIR mapping in n8n and its error handling.
- Guardrails on the chart assistant (scope, citations, injection tests, `:free`-only policy).
- What the evaluation measured, the numbers, failure modes; TGA/HIMAA considerations.
