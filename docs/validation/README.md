# Validation

| File | What it shows | Regenerate with |
|---|---|---|
| `au-core-cohort.md` | Which cohort resources validate against AU Core 2.0.0 | `npm run cohort:validate` |
| `load-local.md` | Result of loading the cohort into the local HAPI server | `npm run load` |

## Running the AU Core validation

Needs Java 17+ and the HL7 validator (about 200 MB, kept out of git):

```bash
mkdir -p .cache
curl -L -o .cache/validator_cli.jar \
  https://github.com/hapifhir/org.hl7.fhir.core/releases/latest/download/validator_cli.jar
npm run cohort:build      # rebuilds data/cohort from the Synthea output (no profile claims yet)
npm run cohort:validate   # trial run, sets the claims that pass, then a proof run (10–20 minutes)
npm run cohort:validate -- --verify   # proof run only, on the files as committed
```

The script exits with an error if any committed resource claims a profile it does not pass, or if
any of the 20 Patients fails AU Core Patient.
