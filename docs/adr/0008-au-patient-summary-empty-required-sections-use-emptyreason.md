# ADR 0008: AU Patient Summary empty required sections use emptyReason

Status: accepted (14 November 2026)

## Context

AU PS 1.0.0 builds on IPS 2.0.1, which has no absent/unknown code system.

## Decision

A required section with nothing to report has no entries and an `emptyReason` of `unavailable`, with narrative saying there is no information.

## Consequences

"None recorded" is said, never "none known".
