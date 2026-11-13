# ClinIQ — Project State

## Completed
- Next.js app scaffolded successfully at /Users/talha/cliniq (TS, Tailwind, ESLint, App Router, src-dir, git initialized).
- Dev server verified working (localhost:3001, port 3000 was occupied by another app).
- Docker Desktop installed and verified (v29.7.2).
- HAPI FHIR server running LOCALLY in Docker container `hapi-fhir` on port 8080 (still available for local dev).
- Java upgraded from 1.8.0 to 17.0.20.1 via Homebrew (needed for Synthea).
- Synthea cloned to ~/synthea, generated 100 synthetic patients into ~/synthea/output/fhir/*.json.
- 85 Synthea patients loaded into LOCAL HAPI FHIR server (curl loop, partial run — plenty for portfolio purposes).
- src/lib/fhir.ts: getPatients() + getPatientDetail(id) — CONFIRMED WORKING (against local FHIR).
- Patient list page (src/app/page.tsx) — CONFIRMED WORKING, links to detail pages.
- Patient detail page (src/app/patient/[id]/page.tsx) — CONFIRMED WORKING: allergies (red-flagged), conditions, recent observations all render.
- Recharts installed. src/components/VitalsChart.tsx created — CONFIRMED WORKING in browser.
- PHASE 1 CORE DASHBOARD SHELL: fully complete and confirmed (list + detail + charts) against local FHIR.
- GitHub repo created and pushed: https://github.com/talhatawsif/cliniq (main branch).
- HOSTING: Render free tier failed (512MB RAM, HAPI FHIR OOM'd). Chose Google Cloud Run instead (pay-per-use, scale-to-zero, free tier sufficient for portfolio traffic — see notes below).
- Google Cloud project `cliniq-507000` created, billing account linked (required even for free tier, verification only).
- gcloud CLI installed and configured.
- HAPI FHIR DEPLOYED TO CLOUD RUN: https://cliniq-fhir-702838448237.us-central1.run.app (2 vCPU, 2GiB RAM, min-instances=0, publicly accessible). Deploy succeeded, confirmed responding (200 on /fhir/metadata).
- Cloud Run upload hit ordering bug (see debug_history.md #9): patient bundles reference Practitioner/Organization by identifier, so hospitalInformation*.json and practitionerInformation*.json must load FIRST. Fix in progress — was mid-reload when usage limit hit.
- Companion file debug_history.md created — running log of issues/fixes, separate from this step tracker.
- IMPORTANT: Not using Cursor at all anymore. All file edits done via terminal heredocs (`cat > file << 'EOF' ... EOF`), always starting with `cd ~/cliniq`. No IDE assumed — terminal only. ALWAYS verify writes with `cat` after — heredocs have silently failed before.
- `npm run dev` is a long-running process — keep it running in one terminal tab; use a second tab for further commands.

## Cloud Run Hosting Notes (for future reference)
- Free tier: 2M requests/month, 240,000 vCPU-seconds/month, 450,000 GiB-seconds/month free.
- Scale-to-zero required to stay free (min-instances=0) — DO NOT set min-instances>0, it would blow the free memory quota in ~62 hrs/month at 2vCPU/2GiB.
- Realistic portfolio usage (~2hrs/month active) uses only ~3% of free quota — safe.
- TRADE-OFF: cold starts after ~15 min idle — first request can take 30-90s (HAPI FHIR/Spring Boot boot time). Mention in README/demos.

## Current Task
Phase 1 DEPLOY, Step 5: Fix ordering issue (see debug_history.md #9) — reload Cloud Run FHIR with correct file order.

## Exact Next Micro-Step
User hit a usage limit mid-task while waiting on the fix loop. Pick up here:

1. Wipe Cloud Run FHIR data:
```
curl -s -X DELETE "https://cliniq-fhir-702838448237.us-central1.run.app/fhir/Patient?_cascade=delete"
curl -s "https://cliniq-fhir-702838448237.us-central1.run.app/fhir/Patient?_summary=count"
```
(check count drops toward 0; may need to run delete twice)

2. Upload hospital + practitioner files FIRST (required — patient bundles reference these by identifier):
```
cd ~/synthea
curl -s -X POST -H "Content-Type: application/fhir+json" -d @output/fhir/hospitalInformation1787958203297.json https://cliniq-fhir-702838448237.us-central1.run.app/fhir -o /dev/null -w "hospital: %{http_code}\n"
curl -s -X POST -H "Content-Type: application/fhir+json" -d @output/fhir/practitionerInformation1787958203297.json https://cliniq-fhir-702838448237.us-central1.run.app/fhir -o /dev/null -w "practitioner: %{http_code}\n"
```
Both should be 200.

3. Then upload remaining patient files (skip the two above):
```
for file in output/fhir/*.json; do
  case "$file" in
    *hospitalInformation*|*practitionerInformation*) continue ;;
  esac
  response=$(curl -s -o /tmp/curl_response.json -w "%{http_code}" -X POST -H "Content-Type: application/fhir+json" -d @"$file" https://cliniq-fhir-702838448237.us-central1.run.app/fhir)
  if [ "$response" != "200" ]; then
    echo "FAILED ($response): $file"
  fi
done
curl -s "https://cliniq-fhir-702838448237.us-central1.run.app/fhir/Patient?_summary=count"
```
4. Reply "done" + final count, or paste FAILED lines (expect far fewer than before).

AFTER THIS SUCCEEDS:
- Update src/lib/fhir.ts FHIR_BASE_URL from localhost:8080 to the Cloud Run URL (or better, use an env var: NEXT_PUBLIC_FHIR_URL, default to Cloud Run URL).
- Deploy Next.js app to Vercel (github repo already pushed: github.com/talhatawsif/cliniq), set env var if used.
- Verify live dashboard end-to-end (list → detail → charts) against Cloud Run FHIR.
- Also see debug_history.md for a running log of past issues/fixes.

## File Structure
```
~/cliniq/
  src/
    app/
      page.tsx              (patient list, links to detail) - WORKING
      patient/[id]/page.tsx (patient detail: allergies/conditions/observations) - WORKING
      layout.tsx, globals.css
    lib/
      fhir.ts   (getPatients, getPatientDetail) - WORKING, currently points to localhost:8080, needs update to Cloud Run URL
    components/
      VitalsChart.tsx (line charts per vital, 2+ points) - WORKING
  public/
  package.json, tsconfig.json, tailwind config
~/synthea/       (generator, output/fhir/*.json — 85 loaded into local HAPI FHIR)
```

## Key Logic Notes
- Local FHIR server: http://localhost:8080/fhir
- Cloud Run FHIR server: https://cliniq-fhir-702838448237.us-central1.run.app/fhir
- getPatientDetail fetches 4 resource types in parallel via Promise.all, keyed by patient id.
- Both list and detail pages are async server components (direct fetch, no client loading states yet).

## Stack Reminder
Next.js (App Router, TS) + Tailwind → HAPI FHIR (Cloud Run) → Synthea data → Supabase (app-level DB/auth) → Vercel deploy.
