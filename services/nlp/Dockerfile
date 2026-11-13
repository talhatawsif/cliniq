# Build stage compiles PyRuSH and unqlite; the final image has no compiler.
FROM python:3.11-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
RUN python -m venv /venv
COPY requirements.txt .
RUN /venv/bin/pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PATH=/venv/bin:$PATH
COPY --from=build /venv /venv
COPY nlp.py main.py targets.json ./
# Fail the build if the pipeline cannot load.
RUN python -c "import nlp"
USER nobody
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
