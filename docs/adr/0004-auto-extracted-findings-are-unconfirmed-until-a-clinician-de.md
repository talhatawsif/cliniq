# ADR 0004: Auto-extracted findings are unconfirmed until a clinician decides

Status: accepted (14 November 2026)

## Context

The human in the loop is the main safety control.

## Decision

Findings are written as `unconfirmed` Conditions with Provenance and a review queue. CDS and exports ignore unconfirmed data. Confirm, change code and reject each write a Provenance and a new version.

## Consequences

Review is manual work; the demo uses one shared reviewer identity.
