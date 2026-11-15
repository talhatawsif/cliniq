# Open work (15 Nov 2026)

One list of everything still open, from a read of the code, docs, plans and decision logs. Tick or delete a row when it is done and
say so in `CHANGELOG.md`. Owner: **C** = Claude can do it, **Y** = needs you (access, a decision, or a physical step).
Security and privacy rows also appear in `docs/COMPLIANCE-MAP.md` (control ids in brackets).

## 1. Security and privacy

| # | Item | Owner | Notes |
|---|---|---|---|
| S1 | Create the Vercel Firewall rate-limit rule for `/cds-services/cliniq-patient-view` (POST, 60 per 60 s per IP, deny) | Y | Dashboard: Project, Firewall. The connector got a 403. Then C tests it and removes `src/lib/cds/ratelimit.ts` [T14] |
| S2 | Apply `supabase/migrations/20261115000000_audit_retention.sql` (90-day purge, enables `pg_cron`) | Y says go, C runs | Confirm the 90 days is right [T11, P6] |
| S3 | Rotate the Supabase secret key and the GCP service-account key | Y | `DECISIONS.md` (M2) says both were shared in chat. Steps in `docs/DEPLOY.md`, "Rotating secrets". Skip if already done [T15] |
| S4 | Sanitise the FHIR narrative HTML rendered with `dangerouslySetInnerHTML` on the summary page | C | `src/app/patient/[id]/summary/page.tsx` [T9] |
| S5 | Chart assistant sends chart text to a free third-party model that may keep it | Y decides, C builds | Options: off for staff accounts, demo account only, or a provider with no retention [P3, P4] |
| S6 | MFA recovery codes (Supabase experimental setting) and roles beyond "staff" | C | Today a lost authenticator means the owner deletes the factor in the Supabase dashboard [T2, T3] |
| S7 | Try staff sign-in on the live site: `node --env-file=.env.local scripts/create-staff.ts <email>`, then scan the QR code | Y | Only tested locally against the same Supabase project |
| S8 | Move the Cloud Run database password to Secret Manager | C with Y's GCP access | `DECISIONS.md` (M2) calls it a shortcut |
| S9 | Replace `GCP_SA_KEY` with Workload Identity Federation (Vercel OIDC to GCP) | C with Y's GCP access | Only if the project outlives the demo [T15] |
| S10 | Check Supabase free-plan backups in the dashboard | Y | Stated from memory in `docs/SECURITY.md`; restore never tested [T16] |
| S11 | Optional: turn off open sign-ups in Supabase Auth | Y | Not needed for safety: the proxy refuses users who are not the demo account or staff |
| S12 | Clear the dev-only `minimatch` notice from `npm audit` | C | Moderate, inside `typescript-eslint`, not deployed. Dependabot is on |
| S13 | Write-once audit store; `audit_events` is an ordinary table | C, only for real use | [T11] |

## 2. Checks not yet run

| # | Item | Owner | Notes |
|---|---|---|---|
| V1 | `npm run e2e:smart` (SMART launch) under the new CSP | C | Needs network access to the SMART sandbox |
| V2 | Send a message through the n8n inbox with `n8n/drop.sh` | C | Writes to the chart; ask first |
| V3 | Check "ClinIQ pathology inbox" shows Active in the n8n UI after the re-import | Y | |
| V4 | Measure the FHIR server's cold start after about 20 minutes idle, and after a long idle (only 13 minutes tested) | Y or C | `docs/DEPLOY.md`, `DECISIONS.md` |
| V5 | 48-hour cost check on Google Cloud; look at the billing page weekly | Y | `README.md` M2 |
| V6 | Test the billing cap's detach path | Y | Untested on purpose: it switches billing off (`infra/billing-cap`) |
| V7 | Run the assistant evaluation live again | C | The 14 Nov run answered 6 of 10 answerable questions; the filter fix was only replayed offline |
| V8 | Add `google/gemma-4-31b-it:free` to the assistant model chain after a one-request probe | C | `docs/llm-model-choice.md` |
| V9 | Run the Python NLP tests in CI | C | They pass locally (25 of 25) but CI runs only Node checks |
| V10 | Run the Playwright suite in CI | C | CI runs lint, typecheck, unit tests and build only |
| V11 | ~~Read `tests/video`, `tests/bugs`, `docs/`~~ done 15 Nov. Not read line by line: `docs/UI.md`, `docs/AI.md` (sections 1-6), the 8 ADRs, `docs/validation/*`, `docs/history/*`, the narration script | C | Skimmed or searched for open items only |
| V12 | Facts written from memory: ACMA fictional phone numbers; Cloud Run Sydney price multiplier; Supabase pooler limits; whether the public CSIRO Ontoserver may be used for a public demo | Y | `DECISIONS.md` ("Not verified") |

| V13 | Re-record `cliniq-n8n.webm`: it still shows an unknown patient being retried three times, but AE and AR are now final. The script label and docs are fixed; the recording (not in git) is not | C records, Y needs n8n running |
| V14 | Re-record `cliniq-demo.webm` to show staff sign-in and the Social & admin section (the current one is still accurate, just older) | C, optional |
| V15 | `tests/bugs/*` (crawl and paste checks) need a running server on port 3100, a saved sign-in and, for paste, a local NLP container; they are not in CI. The crawl does not cover `/mfa`, the staff sign-in or the new endpoints | C |

## 3. Known bugs and small fixes

| # | Item | Owner |
|---|---|---|
| B1 | `scrubNote` turns "CA125" into "CA" (`scripts/cohort`) | C |
| B2 | The cohort email builder gives `undefined.undefined@example.com` for a practitioner with no name | C |
| B3 | The cohort size check counts characters, not bytes | C |
| B4 | The extraction eval shows 0.0% (not "n/a") for classes with no spans, such as "historical" | C |
| B5 | `review_items` rows for wiped Conditions remain after `npm run reset-demo` | C |
| B6 | Old `hl7_messages` rows hold plain control ids, so an already-accepted message is accepted once more (writes are idempotent) | C, low value |
| B7 | Live Supabase migration versions differ from the repo's file names (matters only if the Supabase CLI is used to sync) | C |
| B8 | Dependencies behind: `@playwright/test`, Tailwind, `@types/react*` have patch or minor updates; React 19.3.1, ESLint 10 and TypeScript 7 are majors | C; Dependabot opens the PRs |
| B9 | Regenerated screenshots in `docs/ui/screens/m4` and `m11` are uncommitted | Y decides |

## 4. Product gaps (recorded in the docs)

| # | Item | Owner |
|---|---|---|
| P1 | Patient list: add active-problems and last-encounter columns (skipped: two extra FHIR queries per row) | C |
| P2 | Signed-out landing page; `/` redirects to `/patients` | C |
| P3 | `/api/health` does not report assistant usage | C |
| P4 | Assistant prompt is a TypeScript constant; answer cache and cost breaker live in instance memory | C |
| P5 | A completed care-gap Task blocks a new one for the same gap; needs a new identifier scheme | C |
| P6 | Show an unconfirmed Condition in the screenshots (no fixture patient has one) | C |
| P7 | The social and admin finding list is a fixed SNOMED list; real data needs a value set such as Gravity SDOH | C, only for real use |
| P8 | Extraction recall is 58% by design (the target list is about 100 terms); labels are AI-written, one labeller, no clinician review | Y for a clinician review |
| P9 | Only one HL7 sender path; no multi-tenancy | C, only for real use |
| P10 | shadcn/Radix primitives and design MCP tools were not installed | skip unless needed |
| P11 | SMART mode (`docs/smart.md`): no refresh token (session ends in about an hour), no `user/*` scopes, one launch patient per session, only the sandbox as issuer, no audit rows under a user id | C, only if SMART matters |
| P12 | Assistant: 4 of 10 answerable questions came back "not in the record" in the 14 Nov run; `docs/assistant-eval.md` is a dated snapshot of free models | see V7 |

## 5. Owner steps from `docs/PLAN.md`

| # | Item | Owner |
|---|---|---|
| O1 | Keep-alive pinger (cron-job.org) for the app and the FHIR server | Y |
| O2 | Screen recording of the n8n workflow | Y |
| O3 | Look at the screenshots each UI card commits and reopen the card if a screen looks generic | Y |
| O4 | Register at the NCTS portal for SNOMED CT-AU credentials (optional; the public endpoint works without) | Y |
| O5 | Rename the Vercel team "ADHD-Buddy" to "Talha Portfolio" (optional) | Y |

## 6. Only if this ever handles real data

TGA classification and the clinical decision support exemption; a clinician review of `docs/CLINICAL-SAFETY.md`; a named privacy officer
in `docs/BREACH-RESPONSE.md`; a full privacy policy; Privacy Act / APPs, My Health Records Act and Healthcare Identifiers Act
compliance (real IHIs only for authorised parties); SNOMED CT-AU and ICD-10-AM licensing; a penetration test; backups with a tested
restore. See "Path to production" on `/about`.
