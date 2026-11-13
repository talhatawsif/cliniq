# NLP service (medspaCy)

`POST /extract {"text": "..."}` returns entities found from `targets.json` with context flags
(`negated`, `family`, `historical`, `hypothetical`, `uncertain`), the section heading they sit under, and
character offsets (`text[start:end]` is always the entity text). `GET /health` for liveness. Text is never logged.

Pipeline: blank English tokeniser, PyRuSH sentences, medspaCy target matcher, ConText (medspaCy rules plus
Australian additions: nil, NKDA, PMHx, FHx, `?`), sectioniser. A heading governs its own paragraph only.

## Test

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/pytest -q          # C1-C16 from SPEC.md plus API and offset checks
.venv/bin/python precompute.py   # rewrites data/nlp/precomputed.json (the app's fallback) after changing rules
```

## Deploy (Cloud Run, Sydney, private)

```bash
IMG=australia-southeast1-docker.pkg.dev/cliniq-507000/cliniq/nlp:4
docker build --platform linux/amd64 -t $IMG . && docker push $IMG
gcloud run deploy cliniq-nlp --image $IMG --region australia-southeast1 --project cliniq-507000 \
  --cpu 1 --memory 1Gi --min-instances 0 --max-instances 1 --cpu-boost --no-allow-unauthenticated --concurrency 4
gcloud run services add-iam-policy-binding cliniq-nlp --region australia-southeast1 --project cliniq-507000 \
  --member serviceAccount:cliniq-web@cliniq-507000.iam.gserviceaccount.com --role roles/run.invoker
```

Then set `NLP_SERVICE_URL` (the service URL) in Vercel. The app signs its calls with the same service-account
key as the FHIR server. The image lives in Artifact Registry (the first 0.5 GB is free).
