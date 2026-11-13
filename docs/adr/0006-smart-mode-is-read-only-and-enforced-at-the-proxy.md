# ADR 0006: SMART mode is read-only and enforced at the proxy

Status: accepted (14 November 2026)

## Context

A launch from another system must not write into anything.

## Decision

While a valid SMART cookie is present every non-GET request gets 403, the FHIR client refuses to POST, and only the launch patient is reachable. Tokens live in a sealed httpOnly cookie.

## Consequences

Sessions end with the access token (no refresh).
