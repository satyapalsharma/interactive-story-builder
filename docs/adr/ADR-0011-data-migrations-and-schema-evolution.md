# ADR-0011: Database Schema Migration Strategy

## Status
Accepted

## Context
Database schema updates must be repeatable, reversible, and auditable across all environments.

## Decision
All schema modifications must be scripted in numbered, immutable migration files applied sequentially at startup.

## Consequences
Zero manual DB patching; reproducible local, staging, and production database states.
