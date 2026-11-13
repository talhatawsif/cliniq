# ADR 0007: The chart assistant: one model call, checked afterwards

Status: accepted (14 November 2026)

## Context

Free models are unreliable and limited to 50 requests a day in total.

## Decision

Pre-filter and scripted answers first; then one call down a chain of three free models from different providers; then an output filter that drops any sentence not supported by the cited facts. Cost reported above zero opens a breaker.

## Consequences

A correct derived number is dropped too. The daily limit can make the assistant unavailable.
