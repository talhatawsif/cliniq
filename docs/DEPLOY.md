# Deploying the FHIR server (M2)

Project `cliniq-507000`, region `australia-southeast1`. Image: public Docker Hub HAPI, no Cloud Build.

```sh
# 1. Schema (Supabase session pooler, port 5432 — the direct host is IPv6-only)
#    create schema if not exists hapi;
# 2. Service. hapi.env.yaml holds the SPRING_DATASOURCE_* values (never commit it); see docker-compose.yml
#    for the rest. Database user is postgres.<project-ref>, URL ends ?currentSchema=hapi&sslmode=require.
gcloud run deploy cliniq-fhir --region australia-southeast1 --image docker.io/hapiproject/hapi:v8.12.0-2 \
  --cpu 2 --memory 2Gi --min-instances 0 --max-instances 1 --cpu-boost --no-allow-unauthenticated \
  --env-vars-file hapi.env.yaml
# 3. Invoker
gcloud iam service-accounts create cliniq-web
gcloud run services add-iam-policy-binding cliniq-fhir --region australia-southeast1 \
  --member serviceAccount:cliniq-web@cliniq-507000.iam.gserviceaccount.com --role roles/run.invoker
# 4. Key for Vercel (GCP_SA_KEY, FHIR_AUTH=gcp-iam, FHIR_BASE_URL=<service url>/fhir)
gcloud iam service-accounts keys create key.json --iam-account cliniq-web@cliniq-507000.iam.gserviceaccount.com
# 5. Load data
LOAD_BASE=<service url>/fhir LOAD_TOKEN=$(gcloud auth print-identity-token) npm run load
```

Budget: 1 AUD alert on the billing account (it is AUD, not USD). An alert, not a cap.

## Measurements (13 Nov 2026)
- 403 without a token; 200 with one. 20 patients; still 20 after three new revisions.
- Database 74 MB (limit 250 MB). Warm patient list 0.6–1.5 s.
- Cold start: **not yet measured** — deploys leave the new revision warm. Measure after ~20 min idle.

## JDBC settings that matter
Add to the service env: `SPRING_DATASOURCE_URL` ending `&socketTimeout=15&connectTimeout=10&tcpKeepAlive=true`, `SPRING_DATASOURCE_HIKARI_MAXLIFETIME=120000`, `SPRING_DATASOURCE_HIKARI_KEEPALIVETIME=30000`. Without them the pool fills with dead connections after idle and every request returns 500.

## M6 environment (Vercel, production and preview)
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DEMO_CLINICIAN_EMAIL` (plain) and `DEMO_CLINICIAN_PASSWORD` (sensitive). The demo user is created once with the Supabase admin API (`email_confirm: true`); its password lives in `.env.local` and Vercel only.

## Rotating secrets (owner steps)
- **Service-account key** (`GCP_SA_KEY`): `gcloud iam service-accounts keys create new.json --iam-account cliniq-web@cliniq-507000.iam.gserviceaccount.com`, paste the file into the Vercel variable (Sensitive), redeploy, check `/api/health?deep=1`, then `gcloud iam service-accounts keys delete <old key id> --iam-account ...` and delete `new.json`.
- **Supabase secret key** (`SUPABASE_SECRET_KEY`): Dashboard → Project Settings → API Keys → create a new secret key, update Vercel and `.env.local`, redeploy, then delete the old key.
- **Demo password**: `PUT /auth/v1/admin/users/<id>` with the new password, then update `DEMO_CLINICIAN_PASSWORD` in Vercel and `.env.local`.
- **Invoker grant for the NLP service** (once): `gcloud run services add-iam-policy-binding cliniq-nlp --region australia-southeast1 --project cliniq-507000 --member serviceAccount:cliniq-web@cliniq-507000.iam.gserviceaccount.com --role roles/run.invoker`
