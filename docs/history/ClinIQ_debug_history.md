# ClinIQ — Debug History

## 1. Scaffold command run in wrong directory
- Symptom: `create-next-app` conflict error listing home dir files.
- Cause: ran command in `~` instead of `~/cliniq`.
- Fix: `cd cliniq` first, confirm with `pwd`.

## 2. Port 3000 in use
- Symptom: dev server auto-switched to port 3001.
- Cause: another app (ADHD Buddy) already running on 3000.
- Fix: none needed — just use whichever port Next.js reports.

## 3. Local Synthea → HAPI FHIR upload: only 23/100 then 85/100 loaded
- Symptom: curl loop partial success, high CPU/battery drain.
- Cause: Synthea generates some files that reference future/other resources; a few genuinely fail; also stopped loop early for battery.
- Fix: accepted partial load (85 patients) — plenty for portfolio purposes. Not fully resolved/root-caused at the time.

## 4. Silent heredoc failures (files not written)
- Symptom: `Link` update to patient list page didn't take effect (page stayed old version); patient detail page 404'd because folder/file were never created, despite no visible error.
- Cause: heredoc paste/run likely got interrupted or not fully executed in terminal.
- Fix: ALWAYS verify every file write with `cat <file>` immediately after writing, before moving on. Established as a standing rule.

## 5. Terminal typo mid-heredoc
- Symptom: terminal showed `heredoc>` prompt with pasted content after a typo.
- Cause: heredoc still open, typo just added more literal text.
- Fix: type `EOF` alone on a line to close it, or Ctrl+C to abort; then re-run the write. In this case it self-resolved and file was correct on final `cat` check.

## 6. project_state.md accumulated duplicate sections
- Symptom: multiple "## Completed", "## File Structure", "## Key Logic Notes" headers stacked in the file.
- Cause: repeated str_replace edits appended new versions without removing all old ones cleanly.
- Fix: rewrote file from scratch (bash heredoc overwrite) to dedupe. Lesson: periodically do a full rewrite instead of incremental patches once a file gets messy.

## 7. Render free tier deploy failed — OutOfMemoryError
- Symptom: `java.lang.OutOfMemoryError: Java heap space` during HAPI FHIR boot on Render.
- Cause: Render free tier = 512MB RAM, HAPI FHIR (Spring Boot + FHIR context) needs more (~1-2GB+).
- Fix: switched to Google Cloud Run (2 vCPU / 2GiB RAM, pay-per-use, free tier sufficient for portfolio traffic — see project_ClinIQ_state.md "Cloud Run Hosting Notes").

## 8. Cloud Run billing account required
- Symptom: `FAILED_PRECONDITION: Billing account ... not found` when enabling Cloud Run APIs.
- Cause: Google requires a billing account on file even for free-tier usage (anti-abuse verification).
- Fix: linked a billing account at console.cloud.google.com/billing. No charges incurred by this alone.

## 9. Synthea upload to Cloud Run FHIR: 404 "Invalid match URL ... No resources match this search"
- Symptom: patient bundle uploads failing with HAPI-1091 errors referencing Practitioner/Organization identifiers.
- Cause: Synthea's `hospitalInformation*.json` and `practitionerInformation*.json` files must be loaded FIRST — patient bundles reference these Practitioners/Organizations by identifier and expect them to already exist. The curl loop processes files alphabetically, so patient files (e.g. "Adriana...") uploaded before hospital/practitioner files (starting with lowercase "h"/"p", sorted later).
- Fix (in progress): wipe Cloud Run FHIR data, upload hospitalInformation + practitionerInformation files first, then the rest.
