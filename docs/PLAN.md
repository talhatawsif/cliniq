# ClinIQ — Plan

Human-readable plan: where the project stands, what the owner does by hand, and the build order.
The build spec (milestone cards with acceptance tests) is [`../SPEC.md`](../SPEC.md). Why the spec
looks the way it does is in [`../DECISIONS.md`](../DECISIONS.md). Original notes are in
[`history/`](history/).

## Where it stands (13 Nov 2026)

- **Phase 1 dashboard shell works locally** (patient list, detail, vitals charts) against a local
  Docker HAPI. It still has a hard-coded `localhost` FHIR URL and untyped data.
- **109 Synthea patients** in `~/synthea/output/fhir/` (422 MB, US-shaped).
- **HAPI on Cloud Run in `us-central1`** is up, public, and empty (its built-in database is lost
  on scale-to-zero). It is replaced in M2 by a private service in Sydney.
- **Supabase project `cliniq`** exists in Sydney (`jzrmearcbiuqjbtsecfn`), empty.
- **Spec reviewed and reordered (v3).** No feature code yet.

## Fixed constraints

$0 (free tiers only; at most ~$1 for the NLP service) · OpenRouter `:free` models only ·
Australian focus (AU Core, SNOMED CT-AU / NCTS) · n8n on the owner's Mac · ~20 synthetic patients
on Supabase Free · Sonnet builds one milestone per session.

## Build order

| # | Card | Why here |
|---|---|---|
| M0 | Foundation and live skeleton | Deployed from day one; typed FHIR layer |
| M1 | Australian cohort (offline) | AU-shaped data and an AU Core validation report, no cloud needed |
| M2 | Private FHIR server in Sydney | Persistent data, data residency, no public write access |
| M3 | EHR-style chart | First thing a reviewer sees |
| M4 | Pathology, vitals, FHIR JSON | LOINC handling, SI units |
| M5 | CDS Hooks | Small, well-known standard, tested clinical calculators |
| M6 | Sign-in, audit, quotas | Needed before anything on the public demo can write |
| M7 | HL7 v2 → FHIR | The skill Australian integration roles ask for most |
| | **MVP line — record the demo video, start applying** | |
| M8 | AU Patient Summary export | Current Australian standard, one session |
| M9 | NLP extraction service | Negation, family history, Australian abbreviations |
| M10 | Terminology coding | SNOMED CT-AU via Ontoserver |
| M11 | Write-back and review queue | Provenance and human in the loop |
| | **Headline line — re-record the demo video** | |
| M12 | SMART on FHIR | Breadth |
| M13 | Chart assistant | Guardrails on free models |
| M14 | n8n workflows | Integration-engine orchestration |
| M15 | Evaluation, safety documents, polish | Numbers and the hazard log |

Session prompt for Sonnet:

```
Read AGENTS.md, SPEC.md (§0 rules + card M<n>), docs/PLAN.md and DECISIONS.md. Implement card M<n>
only. Make every "Done when" line pass and show the evidence for each line. Log decisions in
DECISIONS.md, update the README status table and CHANGELOG, commit in small steps, do not push.
End with: what was built, decisions, what I must do by hand.
```

## Owner to-do list (only things Claude cannot do)

Before M0
- [ ] **Revoke the OpenRouter key that was pasted into a chat** and create a new one. Keep the
      account at $0 credit with auto top-up off. Put the key in `.env.local` only.
- [ ] Authorise Vercel for the GitHub repository.

Before M2
- [ ] Supabase database password for project `cliniq` (into env only).
- [ ] Google Cloud: confirm you can deploy to `australia-southeast1`; set a $1 budget alert on
      `cliniq-507000`. The alert does not stop spending — look at the billing page weekly.
- [ ] Create a free cron-job.org account (the card gives the URL and schedule).

Before M10
- [ ] Register at the NCTS portal (healthterminologies.gov.au), accept the SNOMED CT-AU licence
      and create client credentials. Optional: without them the app uses the public CSIRO test
      endpoint or the offline subset.

Before M14
- [ ] Run n8n on the Mac (Docker or `npx n8n`).

Ongoing
- [ ] `git push` after each session.
- [ ] After M7 and again after M11: record a 2–3 minute demo video and link it at the top of the
      README. Most reviewers watch the video and never open the app.
- [ ] Before M15: label the 12 sample notes for the evaluation gold set (about two hours).

## Risks and how they are handled

| Risk | Handling |
|---|---|
| HAPI cold start (1–2 min) loses a reviewer | Pinger keeps it warm 07:00–22:00 Sydney; short read cache; "waking" state; demo video |
| Cloud Run bill from repeated cold starts | Instance-start count checked 48 h after the pinger starts; budget alert; weekly check |
| Supabase fills up (read-only at 500 MB) or pauses | 250 MB budget measured locally first; daily write quotas; `reset-demo`; pinger touches Supabase |
| Public demo abused | Private HAPI, sign-in, quotas, body-size limits |
| OpenRouter 50 requests/day, models vanish | One call per question, cache, scripted fallback; nothing else depends on an LLM |
| NCTS access slow or refused | Public CSIRO endpoint, then offline subset |
| medspaCy does not fit or install | Small image without PyTorch; `precomputed` results keep the demo working |
| AU Core validation fails on Synthea-derived data | A profile is only claimed where it passes; the report says what does not |
| Licences | SNOMED CT-AU attribution; no ICD-10-AM; Synthea is Apache 2.0 |

## Interview talking points

- Why everything sits in Sydney and why HAPI is not reachable from the internet.
- What had to change to make US Synthea data Australian (units and LOINC codes, identifiers, IHI
  check digit) and what honestly was not changed (RxNorm, CVX).
- HL7 v2 ORU^R01 → FHIR: patient matching, ACK codes, idempotency, corrected results.
- CKD-EPI 2021: the formula, the reference tests, why the card says "eGFR category" not "CKD".
- How negation and family history stay out of the problem list, including Australian "nil".
- Why auto-coded Conditions are `unconfirmed` until reviewed, and what Provenance records.
- Why ICD-10-AM is absent (licensing) and what production would need.
- Assistant guardrails: citation filter, patient scope, injection canary, `:free`-only policy.
- What the evaluation measured, the numbers and the failure modes; the hazard log.
