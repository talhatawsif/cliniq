# ClinIQ — Project Plan

**One-liner:** Unstructured clinical notes → extracted diagnoses/symptoms → mapped to SNOMED CT/ICD-10 → written back as FHIR resources → shown on a live patient dashboard alongside vitals, labs, and allergy alerts.

**Portfolio positioning:** Demonstrates the full pipeline a real health-tech data team owns: NLP extraction, clinical terminology mapping, healthcare interoperability standards (FHIR/HL7), and a production-quality frontend. Built manual-first with AI-as-enhancement — every extraction/mapping decision is explainable, not a black box.

**Honest framing (carry this through every README/demo/interview answer):** ClinIQ is a coding-assistance prototype, not a diagnostic or clinical decision-support tool. All auto-extracted and auto-coded output is flagged for clinician review. No claim of clinical validation, regulatory compliance, or diagnostic accuracy is made anywhere in the project.

---

## 1. Architecture Overview

```
[Doctor's free-text note]
        │
        ▼
[Phase 2: Extraction Service] ──uses──▶ [LLM API]
        │  (symptoms, diagnoses, context extracted as structured JSON)
        ▼
[Phase 3: Coding Service] ──queries──▶ [UMLS/SNOMED CT API]
        │  (structured entities mapped to SNOMED CT / ICD-10 codes,
        │   with confidence + disambiguation logic)
        ▼
[Phase 4: FHIR Writer] ──writes──▶ [FHIR Server (HAPI FHIR)]
        │  (Condition / Observation resources created against patient)
        ▼
[Phase 1: Dashboard] ──reads──▶ [FHIR Server]
   (vitals, lab trends, allergy alerts, + newly coded conditions
    all rendered together per patient)
```

Build order deliberately starts with Phase 1 (dashboard + FHIR server) since it gives you a working, demoable artifact almost immediately, and everything else plugs into it incrementally.

---

## 2. Tech Stack

| Component | Tool | Why |
|---|---|---|
| Frontend/dashboard | Next.js (App Router, TypeScript) + Tailwind | TypeScript keeps a multi-stage data pipeline (extraction → coding → FHIR) type-safe end to end; Tailwind keeps UI work fast and consistent |
| Charts | Recharts | Lab trend lines, vitals over time |
| FHIR server | HAPI FHIR (JPA server, self-hosted via Docker) | Industry-standard open-source FHIR reference implementation |
| Synthetic patient data | Synthea | Generates realistic synthetic FHIR bundles (patients, vitals, labs, conditions, meds) — no real PHI, no ethics/privacy hurdles |
| Note source (synthetic) | Synthea's generated clinical notes, or MTSamples (public sample clinical notes/transcriptions) | Avoids needing MIMIC-III/IV credentialing (slow, requires institutional approval) — good enough for a portfolio demo |
| Note extraction | Claude or GPT-4 API (structured JSON output via prompting) | No need to train/fine-tune your own NLP model — scoping stays realistic |
| Terminology mapping | UMLS Metathesaurus API / SNOMED CT Browser API (both free with a UMLS account) | Real, authoritative source for candidate codes — not invented mappings |
| Backend/API layer | Next.js API routes or a small FastAPI service (Python) | FastAPI if you want the coding-mapping logic in Python (good ecosystem for text processing); Next.js API routes if you want to keep one language throughout |
| Database (app-level) | Supabase (Postgres) | Stores pipeline run history, confidence scores, review status — not FHIR data itself (that lives in HAPI FHIR) |
| Auth | Supabase Auth | Gates the dashboard behind login |
| Hosting — frontend | Vercel | Zero-config deploys, generous free tier for a portfolio project |
| Hosting — FHIR server | Render or Railway (Docker support, free/cheap tier) | HAPI FHIR needs a real server, not a serverless function |
| Hosting — extraction/coding service (if separate) | Render or Railway alongside FHIR server | Keep backend services co-located |

---

## 3. Data Sources — Setup Details

- **Synthea**: open-source (Java), generates FHIR-format synthetic patients. Run locally: `git clone https://github.com/synthetichealth/synthea && ./run_synthea -p 100` generates 100 synthetic patients with full histories (conditions, meds, labs, vitals) as FHIR bundles. Load these into your HAPI FHIR server via its REST API.
- **UMLS account**: free, sign up at the UMLS Terminology Services site (approval can take 1–3 business days — do this in week 1, not when you need it). Gives API access to SNOMED CT and ICD-10 lookups.
- **MTSamples**: public dataset of sample clinical transcriptions across specialties — usable as realistic-but-non-PHI input text for the extraction phase. (If you later want real de-identified notes, MIMIC-IV requires a CITI training certificate + PhysioNet credentialing — doable, but treat as a stretch goal, not a blocker.)

---

## 4. Phased Build Plan

### Phase 1 — FHIR Foundation & Dashboard Shell
**Goal:** A working, demoable dashboard on real (synthetic) FHIR data — shippable on its own.

- [ ] Spin up HAPI FHIR server via Docker (`hapiproject/hapi:latest` image)
- [ ] Generate synthetic patients with Synthea, load FHIR bundles into HAPI FHIR
- [ ] Scaffold Next.js app, connect to FHIR server's REST API
- [ ] Build patient list view (search/filter)
- [ ] Build patient detail view: demographics, vitals over time (chart), lab trends (chart), active conditions, allergy alerts (visually distinct/urgent styling)
- [ ] Deploy dashboard to Vercel, FHIR server to Render/Railway
- **Milestone output:** live URL showing a real FHIR-backed dashboard with synthetic patients — demoable in interviews even before Phases 2–4 exist.

### Phase 2 — Note Extraction Core
**Goal:** Turn unstructured note text into structured entities.

- [ ] Collect sample notes (MTSamples + Synthea-generated notes)
- [ ] Design extraction prompt: input = raw note text, output = structured JSON (symptom/diagnosis, mentioned context, negation handling — e.g. "no chest pain" must not become a positive finding)
- [ ] Build extraction service (API route or FastAPI endpoint) calling the LLM API
- [ ] Handle edge cases: negated findings, family-history-only mentions, uncertain/hedged language ("possible pneumonia")
- [ ] Log every extraction with the source note text for later review/audit
- **Milestone output:** paste a note in, get back structured extracted entities — demoable as a standalone tool.

### Phase 3 — SNOMED/ICD-10 Mapping (hardest, most interesting phase)
**Goal:** Map each extracted entity to a real terminology code with defensible logic.

- [ ] Query UMLS/SNOMED CT API for candidate codes per extracted term
- [ ] Build disambiguation logic: when a term maps to multiple candidate codes (e.g. "chest pain" → several SNOMED concepts), use surrounding note context (second LLM pass, or rule-based scoring against candidate code descriptions) to pick the best match
- [ ] Attach a confidence score to every mapping
- [ ] Build a small internal review UI: extracted term → suggested code(s) → confidence → accept/override
- [ ] Document your disambiguation approach thoroughly — this is your best interview talking point and blog post material
- **Milestone output:** structured entities now carry real SNOMED CT/ICD-10 codes with visible confidence and reasoning.

### Phase 4 — Pipeline Integration
**Goal:** Connect everything into one live product.

- [ ] Coded output gets written back to HAPI FHIR as `Condition`/`Observation` resources against the correct patient
- [ ] Dashboard renders newly coded conditions inline with existing vitals/allergies, clearly marked as "auto-extracted — pending review" until accepted
- [ ] Build the end-to-end demo flow: paste/select a note → watch it get extracted → coded → appear on the patient's dashboard
- **Milestone output:** the full pipeline working as one coherent product — this is your headline demo.

### Phase 5 — Polish, Proof, and Wrap-Up
**Goal:** Make the project credible, tested, and interview-ready.

- [ ] **Testing/proof strategy:**
  - Unit tests for extraction parsing and code-mapping logic
  - A small hand-labeled evaluation set (e.g. 20–30 notes you manually annotate with correct SNOMED codes) to report basic precision/recall for the mapping step — this single evaluation set is what turns "I built a coder" into "I measured how well my coder works," which is a major credibility jump
  - Document known failure modes honestly (e.g. "struggles with negation in complex sentences") — shows engineering maturity
- [ ] Confidence-score UI treatment and "flagged for review" states finalized throughout
- [ ] Write README (setup instructions, architecture diagram, honest scope/limitations section)
- [ ] Write technical blog post — recommend focusing on the SNOMED disambiguation logic (Phase 3), since it's the most technically interesting and least commonly written-about part
- [ ] Add to LinkedIn Featured/Projects section
- [ ] Record a short demo video/GIF for the README and LinkedIn post

---

## 5. Deployment Checklist

- [ ] HAPI FHIR server deployed (Render/Railway), with environment-restricted access (not open to the public internet without auth)
- [ ] Extraction/coding backend service deployed alongside it
- [ ] Next.js frontend deployed on Vercel, environment variables set for FHIR server URL, LLM API key, UMLS API key, Supabase keys
- [ ] Supabase project set up for app-level data (pipeline run logs, review status) with Row Level Security scoped correctly on every table
- [ ] All API keys in environment variables, never committed to the repo
- [ ] Custom domain or clean Vercel URL for the live demo link

---

## 6. Suggested Timeline (loose — you have ~1.8 years, no need to rush)

- Weeks 1–3: Phase 1 (dashboard + FHIR foundation)
- Weeks 4–6: Phase 2 (extraction core)
- Weeks 7–10: Phase 3 (SNOMED mapping — expect this to take the longest, it's the hardest part)
- Weeks 11–12: Phase 4 (integration)
- Weeks 13–14: Phase 5 (testing, polish, writing)

This leaves the bulk of your 1.8 years free for internship applications, coursework, and a possible third project if you want one later.
