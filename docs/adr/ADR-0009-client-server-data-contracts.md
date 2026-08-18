# ADR-0009: Client-Server Contract and API Versioning

## Status
Accepted

## Context
API changes must not break existing clients or mobile frontends without deprecation notices.

## Decision
Prefix API endpoints with version namespaces and guarantee backward compatibility of JSON response schemas.

## Consequences
Clients can safely rely on immutable response shapes and typed DTO interfaces.
