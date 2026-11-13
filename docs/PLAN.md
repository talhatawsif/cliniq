# ClinIQ — Plan

Human-readable plan: where the project stands, what to do before the big build, the one build run,
and what to do after. The detailed build spec is [`../SPEC.md`](../SPEC.md). Original notes are in
[`history/`](history/).

## Where it stands (13 Nov 2026)

- **Phase 1 dashboard shell works locally:** patient list, patient detail (allergies, conditions,
  observations), Recharts vitals. Committed as `ace6803`.
- **Local HAPI FHIR** in Docker (`hapi-fhir`, port 8080) with 85 Synthea patients loaded.
- **HAPI FHIR on Google Cloud Run** (`cliniq-fhir-702838448237.us-central1.run.app`, project
  `cliniq-507000`, 2 vCPU / 2 GiB, scale-to-zero). On 13 Nov it was up but held **0 patients** and
  took ~2 minutes to cold-start. Most likely cause: HAPI uses its built-in database inside the
  container, so data is lost whenever the instance scales to zero. Must fix before anything else.
- **Not done:** app still points at `localhost:8080`; no Vercel deploy; no Supabase project;
  Phases 2–5 (extraction, coding, write-back, evaluation) not started.

## What makes it portfolio-grade

Health IT reviewers judge standards fluency, safety and engineering maturity:

1. **SMART on FHIR** launch from the SMART Health IT sandbox, plus a demo mode.
2. **EHR-style chart:** banner with allergy alerts, problem list by clinical status, medications,
   encounters, immunisations.
3. **Labs and vitals done properly:** grouped by LOINC, BP as systolic/diastolic panel, reference
   ranges and high/low flags.
4. **A real CDS Hooks service** (discovery + `patient-view`) returning cards for BMI, eGFR (CKD-EPI
   2021) and care gaps, unit-tested, usable from the public CDS Hooks sandbox.
5. **View FHIR JSON** on every record, and **International Patient Summary** export, validated.
6. **Supabase for app data only:** login and an AuditEvent-shaped audit log of every chart view.
7. **AI patient summary** where every sentence cites its source resources (optional, behind a flag).
8. **Professional finish:** strict types, unit + E2E + accessibility tests, CI, README with
   architecture diagram and screenshots, synthetic-data disclaimer.

Plus the original headline pipeline (notes → SNOMED CT / ICD-10 → FHIR), done the way an
informatician would expect:

9. **Native FHIR review states:** auto-coded conditions are written as `verificationStatus =
   unconfirmed` with `evidence` pointing at the source note, and confirmed/refuted on review.
10. **Provenance resources** on everything the pipeline writes (which model, which prompt version,
    from which note).
11. **`$validate` before every write**, showing the OperationOutcome when something is wrong.
12. **A FHIR terminology server** (NCTS Ontoserver, SNOMED CT-AU) instead of a hard-coded code list
    — a strong Australian-market signal.
13. **A measured evaluation:** precision/recall on a hand-labelled gold set, with known failure modes
    written up honestly.
14. **Architecture Decision Records** and a **short threat model** (`docs/adr/`, `docs/SECURITY.md`).
15. **Accessibility** (WCAG 2.2 AA checks in tests) and a **case-study page** inside the app.

## Step 1 — Prep before the build run (cheap, do with Sonnet/Opus)

The build run should spend its effort on code, not on accounts, keys or infrastructure.

- [ ] **Persist HAPI data.** Create a `cliniq` Supabase project (free tier, 500 MB). Point the Cloud
      Run HAPI service at its Postgres via env vars (`spring.datasource.*`, Postgres dialect, a
      separate `hapi` schema; use the Supabase **session pooler** connection string because the
      direct host is IPv6-only). Redeploy.
- [ ] **Reload data in the right order** (hospitals, practitioners, then patients) — about 25–40
      patients to stay under 500 MB. Confirm the count survives a scale-to-zero.
- [ ] **Keys and accounts** (only the owner can do these):
  - **No paid API needed.** Extraction runs on a free rules engine plus results precomputed by
    Claude Code during the build; the summary is template-built. (Optional later: bring your own
    LLM key.)
  - Terminology: NCTS account (free for Australian users) → Ontoserver client credentials. UMLS as
    the fallback (approval takes 1–3 business days).
- [ ] **Cost guard:** add a Google Cloud budget alert (for example $1) on project `cliniq-507000`,
      because a billing account is linked. Keep `min-instances=0`; do not use Cloud SQL.
- [ ] **Vercel:** approve Claude's access to the team, create the project linked to the GitHub repo.
- [ ] **Env:** fill `.env.local` and Vercel env vars per `SPEC.md` §5.
- [ ] **Check reachability** of the SMART sandbox, CDS Hooks sandbox and terminology server.
- [ ] **Commit a clean baseline** and push.

## Step 2 — The one build run (Claude Fable, Claude Code on this Mac)

Run it in Claude Code from `~/cliniq` (switch model with `/model` right before) so it can use the local browser and `.env.local`:

```
Read AGENTS.md, then SPEC.md, then docs/PLAN.md. Implement SPEC.md completely, tier by tier, in
order. Don't ask me questions: decide, and log each decision in DECISIONS.md. Before finishing,
lint, typecheck, unit tests, e2e tests and build must all pass, and you must click through every
main flow in a browser (list → chart → pipeline: paste a note → extracted → coded → validated →
written as unconfirmed → confirmed in the review queue → shown on the chart). Commit in logical
steps. End with a summary of what was built, decisions, what's left, and what I must do by hand.
```

## Step 3 — After the run (cheap)

- [ ] Review the summary and `DECISIONS.md`; fix small issues.
- [ ] Deploy to Vercel; verify the live demo end to end, including cold start.
- [ ] **Hand-label the gold set** (20–30 notes) yourself, run `npm run eval`, commit the report.
      AI-written labels would not be an honest evaluation, and doing it is the best way to learn the
      material.
- [ ] Screenshots + a 60–90 s demo video / GIF for the README and LinkedIn.
- [ ] Blog post on the SNOMED disambiguation approach (from the original plan).
- [ ] Pin the repo, add to LinkedIn Featured, add the live link to the README.

## Talking points to prepare (for interviews)

- Why FHIR stays the system of record and Supabase only holds app data.
- How negation and family history are kept out of positive findings.
- How a code is chosen when several SNOMED concepts match, and how confident the system is.
- Why auto-coded conditions are `unconfirmed` until a human confirms them, and what Provenance adds.
- What CDS Hooks is and why the cards are a service, not just UI.
- What the evaluation measured, the numbers, and the known failure modes.
