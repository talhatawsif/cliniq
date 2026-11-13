#!/usr/bin/env bash
# Tests the OpenRouter key in .env.local against FREE models only (ids ending in ":free").
# Usage: bash scripts/test-openrouter.sh [model-id]   (model must end in :free)
set -u
cd "$(dirname "$0")/.."
KEY=$(grep -E '^OPENROUTER_API_KEY=' .env.local | cut -d= -f2-)
[ -z "$KEY" ] && { echo "No OPENROUTER_API_KEY in .env.local"; exit 1; }

echo "== key status =="
curl -s https://openrouter.ai/api/v1/key -H "Authorization: Bearer $KEY" | python3 -c 'import sys,json; d=json.load(sys.stdin).get("data",{}); print({k:d.get(k) for k in ("label","is_free_tier","usage","limit","limit_remaining")})'

if [ $# -ge 1 ]; then CANDIDATES="$1"; else
  CANDIDATES=$(curl -s https://openrouter.ai/api/v1/models | python3 -c 'import sys,json; [print(m["id"]) for m in json.load(sys.stdin)["data"] if m["id"].endswith(":free")]' | head -15)
fi
for M in $CANDIDATES; do
  case "$M" in *:free) ;; *) echo "REFUSED (not :free): $M"; exit 2;; esac
  echo "== trying $M =="
  R=$(curl -s -m 60 https://openrouter.ai/api/v1/chat/completions -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -d "{\"model\":\"$M\",\"max_tokens\":20,\"messages\":[{\"role\":\"user\",\"content\":\"Reply with the single word: ok\"}]}")
  echo "$R" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("OK:", d["choices"][0]["message"]["content"].strip()) if "choices" in d else print("FAIL:", d.get("error",{}).get("code"), str(d.get("error",{}).get("message"))[:120])'
done
