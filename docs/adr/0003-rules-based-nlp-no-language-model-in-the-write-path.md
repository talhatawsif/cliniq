# ADR 0003: Rules-based NLP, no language model in the write path

Status: accepted (14 November 2026)

## Context

Extraction must be explainable, testable and safe to run on free infrastructure.

## Decision

medspaCy (target matcher, ConText, sectioniser) in a small Cloud Run service, with 16 exact acceptance tests. Language models are used only by the chart assistant, never to extract, code or write.

## Consequences

Recall is limited by the target list and rules; the evaluation reports it against owner-written gold labels.
