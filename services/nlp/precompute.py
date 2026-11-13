"""Runs the pipeline over data/sample-notes and writes data/nlp/precomputed.json (the app's fallback)."""
import json
from pathlib import Path

from nlp import extract

root = Path(__file__).resolve().parents[2]
out = {}
for f in sorted((root / "data/sample-notes").glob("*.txt")):
    text = f.read_text()
    out[f.name] = {"text_length": len(text), "entities": extract(text)}
(root / "data/nlp").mkdir(exist_ok=True)
(root / "data/nlp/precomputed.json").write_text(json.dumps({"engine": "medspacy", "notes": out}, indent=1) + "\n")
print({k: len(v["entities"]) for k, v in out.items()})
