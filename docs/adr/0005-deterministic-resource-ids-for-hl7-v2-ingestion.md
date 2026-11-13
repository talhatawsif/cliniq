# ADR 0005: Deterministic resource ids for HL7 v2 ingestion

Status: accepted (14 November 2026)

## Context

Labs resend and correct messages; the app must not duplicate or lose results.

## Decision

Ids derive from the filler order number and test code in a transaction of PUTs. Duplicate control ids are acknowledged without a write. Unknown patients are never created.

## Consequences

One order per message is handled; a lab that reuses filler numbers would overwrite.
