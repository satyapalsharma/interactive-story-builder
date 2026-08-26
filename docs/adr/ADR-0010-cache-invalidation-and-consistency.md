# ADR-0010: State Caching and Invalidation Invariants

## Status
Accepted

## Context
Repeated database reads on hot paths degrade performance under concurrent user traffic.

## Decision
Introduce in-memory and write-through caching with bounded TTLs and immediate key invalidation on state mutations.

## Consequences
Sub-millisecond read latency on hot data while preserving eventual consistency guarantees.
