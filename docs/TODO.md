# Open work (15 Nov 2026)

What is still open, after each item was checked for whether it is worth doing. Tick or delete a row when it is done and say so in
`CHANGELOG.md`. Owner: **C** = Claude can do it, **Y** = needs you (access, a decision, or a physical step).
Security and privacy rows also appear in `docs/COMPLIANCE-MAP.md` (control ids in brackets).

## 1. To do now

| # | Item | Owner | Notes |
|---|---|---|---|
| S1 | Create the Vercel Firewall rate-limit rule for `/cds-services/cliniq-patient-view` (POST, 60 per 60 s per IP, deny) | Y | Dashboard: Project, Firewall. The connector got a 403. Then C tests it and removes `src/lib/cds/ratelimit.ts` [T14] |
| S2 | Apply `supabase/migrations/20261115000000_audit_retention.sql` (90-day purge, enables `pg_cron`) | Y says go, C runs | Confirm 90 days is right [T11, P6] |
| S3 | Rotate the Supabase secret key and the GCP service-account key | Y | `DECISIONS.md` (M2) says both were shared in chat. Steps in `docs/DEPLOY.md`, "Rotating secrets". Skip if already done [T15] |
| S7 | Try staff sign-in on the live site: `node --env-file=.env.local scripts/create-staff.ts <email>`, then scan the QR code | Y | Only tested locally, against the same Supabase project |
| S10 | Check Supabase free-plan backups in the dashboard | Y | Stated from memory in `docs/SECURITY.md`; restore never tested [T16] |
| S11 | Turn off open sign-ups in Supabase Auth | Y | The proxy already refuses users who are not the demo account or staff; this stops junk accounts |
| V3 | Check "ClinIQ pathology inbox" shows Active in the n8n UI after the re-import | Y | Its webhook already answers (tested 15 Nov), so it is active; this is only a look at the toggle |
| V12 | Check that the public CSIRO Ontoserver endpoint may be used for a public demo | Y | `DECISIONS.md` ("Not verified"); the app uses it when NCTS credentials are not set |
| V10 | Run the Playwright suite in CI | C, Y adds the GitHub secrets | Needs a HAPI service container with the cohort loaded and the Supabase keys as GitHub secrets. If that is too heavy, start with the tests that need no Supabase |
| B9 | Regenerated screenshots in `docs/ui/screens/m4` and `m11` are uncommitted | Y decides | Commit or discard |

## 2. Optional: claims in the README that could be refreshed

| # | Item | Owner |
|---|---|---|
| V4 | Measure the FHIR server's cold start after about 20 minutes idle, and after a long idle (only 13 minutes tested) | Y or C |
| V5 | Close the 48-hour cost check on Google Cloud (the 48 hours have probably passed); look at the billing page weekly | Y |
| V7 | Run the assistant evaluation live again: the 14 Nov run answered 6 of 10 answerable questions, and the filter fix was only replayed offline | C |

## 3. Owner steps from `docs/PLAN.md`

| # | Item | Owner |
|---|---|---|
| O1 | Keep-alive pinger (cron-job.org) for the app and the FHIR server | Y |
| O2 | Screen recording of the n8n workflow (see V13) | Y |
| O3 | Look at the screenshots each UI card commits and reopen the card if a screen looks generic | Y |
| O4 | Register at the NCTS portal for SNOMED CT-AU credentials (optional; the public endpoint works without) | Y |
| O5 | Rename the Vercel team "ADHD-Buddy" to "Talha Portfolio" (optional) | Y |

## 4. Only when real data will be used

Do none of these for the demo. Each one matters only if the app ever handles real patient data.

| # | Item |
|---|---|
| S5 | The chart assistant sends chart text to a free third-party model that may keep it: switch off for real accounts, or use a provider with no retention [P3, P4] |
| S8 | Move the Cloud Run database password to Secret Manager |
| S9 | Replace `GCP_SA_KEY` with Workload Identity Federation (Vercel OIDC to GCP) [T15] |
| S13 | Write-once audit store; `audit_events` is an ordinary table [T11] |
| P7 | The social and admin finding list is a fixed SNOMED list; real data needs a value set such as Gravity SDOH |
| P9 | Only one HL7 sender path; no multi-tenancy |
| — | TGA classification and the clinical decision support exemption; a clinician review of `docs/CLINICAL-SAFETY.md`; a named privacy officer in `docs/BREACH-RESPONSE.md`; a full privacy policy; Privacy Act / APPs, My Health Records Act and Healthcare Identifiers Act compliance (real IHIs only for authorised parties); SNOMED CT-AU and ICD-10-AM licensing; a penetration test; backups with a tested restore. See "Path to production" on `/about` |

## 5. Decided not to do (15 Nov 2026)

Checked and left out on purpose, so they are not raised again:

- **MFA recovery codes (S6):** the hosted Supabase project has the feature switched off (`mfa_recovery_codes_enroll_not_enabled`). Instead: `scripts/reset-staff-mfa.ts`, and a read-only "viewer" role was added.
- **Sanitise the summary page HTML:** it is built by the app (`src/lib/ps/build.ts`), and every value is escaped.
- **`minimatch` notice in `npm audit`:** moderate, dev-only (`typescript-eslint`), not deployed. Dependabot is on.
- **Test the billing cap's detach path:** untested on purpose, it switches billing off.
- **Add `gemma-4-31b-it:free` to the model chain:** unverified (rate-limited in the probe) and marginal.
- **Re-record the demo video for staff sign-in:** the current one is accurate, only older.
- **`tests/bugs` follow-ups:** exploratory checks that need a local server; not part of CI by design.
- **Other facts written from memory** (ACMA fictional phone numbers, Cloud Run Sydney price multiplier, Supabase pooler limits): no decision depends on them.
- **Cohort build edge cases** (`scrubNote` turning "CA125" into "CA", the email builder for a practitioner with no name, character versus byte size check): a one-off run on fixed Synthea data that is already committed.
- **Old `hl7_messages` control ids, live Supabase migration numbering, dependency updates:** writes are idempotent; the numbering matters only if the Supabase CLI is used; Dependabot covers updates.
- **Product gaps recorded in the docs, working as intended:** patient list problem and encounter columns (two extra FHIR queries per row), prompt as a Markdown file and a cache table, reopening a completed care-gap Task, the 58% extraction recall and AI-written labels, shadcn/Radix and the design tools, SMART limits (no refresh token, sandbox issuer only), and the 14 Nov assistant snapshot (see V7).
