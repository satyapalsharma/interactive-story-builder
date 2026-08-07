# ADR-0005: Standardized Error Representation

## Status
Accepted

## Context
Inconsistent error payloads increase client parsing burden and make debugging unpredictable.

## Decision
Adopt uniform structured JSON envelope for all non-2xx responses with unambiguous error codes and user messages.

## Consequences
Clients can predictably inspect error codes and display helpful feedback to users.
