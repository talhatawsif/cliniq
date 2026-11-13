#!/usr/bin/env bash
# Sends an HL7 v2 file to the "ClinIQ pathology inbox" workflow (the webhook stands in for a watched folder:
# n8n 2.x disables the Local File Trigger and Execute Command nodes by default).
# Usage: n8n/drop.sh data/hl7v2/oru-demo-creatinine.hl7 [n8n-base-url]
set -euo pipefail
FILE="${1:?usage: n8n/drop.sh <file.hl7> [n8n-base-url]}"
BASE="${2:-http://localhost:5678}"
# An HL7 message must be sent as it is: \r separators, no changes. curl --data-binary keeps the bytes.
curl -sS -X POST "$BASE/webhook/cliniq-hl7?name=$(basename "$FILE")" -H "Content-Type: text/plain" --data-binary "@$FILE" -w "\nHTTP %{http_code}\n"
