"""POST /extract: clinical text in, entities with context flags out. Private on Cloud Run (IAM)."""
from fastapi import FastAPI
from pydantic import BaseModel, Field

from nlp import extract

app = FastAPI(title="ClinIQ NLP", docs_url=None, redoc_url=None)


class Request(BaseModel):
    text: str = Field(min_length=1, max_length=50_000)  # characters, matching the app's 50 kB body cap


@app.get("/health")
def health():
    return {"status": "ok", "engine": "medspacy"}


@app.post("/extract")
def run(req: Request):
    # Never log req.text: it is patient content.
    return {"engine": "medspacy", "entities": extract(req.text)}
