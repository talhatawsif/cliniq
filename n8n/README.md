# n8n workflows

n8n only calls the ClinIQ app API with the integration key (`x-api-key`); it never talks to the FHIR server. All mapping and
rule logic stays in the tested TypeScript behind the endpoints.

| Workflow | File | Trigger | What it does |
|---|---|---|---|
| ClinIQ pathology inbox | `workflows/pathology-inbox.json` | Webhook `POST /webhook/cliniq-hl7` | Sends the HL7 v2 text to `POST /api/hl7v2`. On ACK `AA` it saves the file to `hl7/done/`. On `AE`/`AR`/an error it retries 3 times (2 s, 4 s, 8 s back-off), then saves it to `hl7/failed/` with a `.notice.txt` and replies 502 with the ACK. A failed message is also kept in the app's `hl7_messages` log |
| ClinIQ weekly care-gap sweep | `workflows/care-gap-sweep.json` | Mondays 07:00 Sydney, or "Run now" | `POST /api/care-gaps/sweep`: one FHIR `Task` per open care gap (same rules as the CDS card), created once. Retries 3 times |
| ClinIQ error notice | `workflows/error-notice.json` | Error workflow of the two above | Writes a notice file under `notices/` |

Diagrams: [`docs/n8n/`](../docs/n8n/README.md).

## Set up

1. Start n8n (the `~/n8n` Compose stack, `docker start n8n-n8n-1`). Files are written under `/home/node/.n8n-files/`:
   `docker exec n8n-n8n-1 mkdir -p /home/node/.n8n-files/hl7/done /home/node/.n8n-files/hl7/failed /home/node/.n8n-files/notices`
2. Create a **Header Auth** credential in n8n named `ClinIQ integration key`, id `cliniq-integration-key`, header name
   `x-api-key`, value = `INTEGRATION_API_KEY` from the app's environment. The workflow files hold only the credential's name
   and id, never its value.
3. Import and publish (the error workflow first): `n8n import:workflow --input=...` for each file, then
   `n8n publish:workflow --id=cliniq-error-notice` (and `cliniq-hl7-inbox`, `cliniq-care-gap-sweep`), then restart n8n.
4. The app URL is the `appUrl` field of the **Prepare** node (inbox) and the URL of **Sweep care gaps**; both default to
   `https://cliniq-inky-ten.vercel.app`.

## Try it

```bash
n8n/drop.sh data/hl7v2/oru-demo-creatinine.hl7     # -> ACK AA, file in hl7/done/, creatinine 132 on the chart
n8n/drop.sh data/hl7v2/oru-creatinine.hl7          # unknown patient -> AE, retries, file in hl7/failed/
docker exec n8n-n8n-1 ls /home/node/.n8n-files/hl7/done /home/node/.n8n-files/hl7/failed
```

A message with a control id that was already accepted gets `AA` again and writes nothing, so use a fresh control id
(MSH-10) to send the demo file twice.

## Limits

- The webhook stands in for a watched folder: n8n 2.x disables the Local File Trigger and Execute Command nodes by default, and
  re-enabling them would change the shared n8n install. `drop.sh` is the "drop".
- "Notify" writes a notice file; real notification (email, Slack) needs a credential for that service.
- Back-off is 2, 4 and 8 seconds, short enough for a demo.
