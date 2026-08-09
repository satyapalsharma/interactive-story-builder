# ADR-0006: Asynchronous Operations and Background Execution

## Status
Accepted

## Context
Long-running computational tasks or notifications must not block request-response lifecycle loops.

## Decision
Execute deferred background tasks using task runners and promises with structured error isolation.

## Consequences
API handlers return responsive HTTP 200/202 responses while background work finishes reliably.
