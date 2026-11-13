# ADR 0001: Private HAPI FHIR server on Cloud Run with Supabase Postgres

Status: accepted (14 November 2026)

## Context

The app needs a real FHIR R4 server that scales to zero and costs nothing when idle, with a hard spend cap.

## Decision

Run HAPI FHIR (`hapiproject/hapi`) on Cloud Run in Sydney, private (`--no-allow-unauthenticated`), with its database on Supabase Postgres. Only the Vercel server, through a service account, may call it. A budget alert triggers a function that detaches billing at 1 AUD.

## Consequences

A cold start takes about a minute (measured 57 s). The browser never reaches FHIR. Free-tier limits (250 MB database) bound the cohort.
