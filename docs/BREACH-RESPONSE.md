# Breach response

The demo holds synthetic data only, so no breach of real personal information is possible today. This is the procedure to
follow before any real data is used. It is modelled on the Notifiable Data Breaches scheme (Privacy Act 1988, Part IIIC).

## 1. Contain (first hour)
Rotate, in this order, then redeploy:
1. `SUPABASE_SECRET_KEY` (Supabase project settings) and revoke all user sessions.
2. `GCP_SA_KEY`: delete the key for `cliniq-web` and create a new one. Check Cloud Run invocations for the FHIR service.
3. `SESSION_SECRET` (invalidates SMART cookies) and `INTEGRATION_API_KEY` (also in n8n).
4. Vercel environment variables, then redeploy. If spend is unusual, the billing cap in `infra/billing-cap/` detaches billing.

## 2. Assess (within 30 days of suspecting a breach, sooner if possible)
- What data, whose, how many: Cloud Run request logs for the FHIR server, Vercel request logs, `audit_events` (kept 90 days).
- Is it **likely to cause serious harm** to anyone? If yes it is an eligible breach.
- Did remediation remove the likely harm? If yes it may not be notifiable.

## 3. Notify (eligible breaches, as soon as practicable)
- The Office of the Australian Information Commissioner (OAIC) through its notifiable data breach form.
- Each affected person (or the likely-affected group), saying what happened, what data, and what they can do.
- Healthcare providers connected to the system, and for My Health Record data the System Operator.

## 4. Review
Write down cause, timeline, what was done and the fix. Add a hazard to `docs/CLINICAL-SAFETY.md` if patient safety was involved.
Update `docs/SECURITY.md`.

Owner: the project owner. For a real deployment name a privacy officer and a contact here.
