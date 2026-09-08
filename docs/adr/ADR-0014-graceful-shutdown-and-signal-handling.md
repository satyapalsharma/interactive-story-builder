# ADR-0014: Graceful Process Termination and Signal Handling

## Status
Accepted

## Context
Abrupt server termination drops inflight transactions, causing database locks and incomplete work.

## Decision
Listen for SIGINT and SIGTERM signals to finish pending requests and close connections before exit.

## Consequences
Clean zero-downtime server restarts and zero database corruption during container deployments.
