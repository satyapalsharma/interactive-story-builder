# ADR-0013: Configuration and Secrets Segregation

## Status
Accepted

## Context
Sensitive tokens, API keys, and database passwords must never leak into git repositories.

## Decision
Read all secrets from runtime environment variables with checked-in .env.example templates.

## Consequences
Guarantees zero hardcoded credentials and seamless containerized deployments.
