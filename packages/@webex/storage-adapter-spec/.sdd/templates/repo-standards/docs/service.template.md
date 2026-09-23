---
type: Service Spec
title: '[Service name] service specification'
description: Runtime, contracts, data, resilience, observability, and operating posture for one deployable service.
tags: [service-spec]
---
<!-- ───────────────────────────────
  Template:     Service Specification
  Template-ID:  service
  Generates:    docs/service.md
  Description:  Resolved from WebexTools/repo-standards templates/docs/service.md
  Library ver:  0.3.0
  Source:       WebexTools/repo-standards@d89a7fe59126ae3ad9bac9ca352aa7f12b4c85dc templates/docs/service.md
  Last updated: 2026-08-24
─────────────────────────────── -->

# [Service name] service specification

Use this document only for a deployable service. It owns service-local runtime
and operating facts; repository-wide boundaries and relationships belong in
[architecture.md](architecture.md). Source-local module specifications should link to both
owners as applicable instead of duplicating them.

When a repository contains multiple deployable services, use this page as a
service navigator and register one owner-local service specification per
service in the [specification registry](specs/README.md). Do not merge unrelated runtime
facts into one service authority.

## Overview

What this deployable service does, its primary consumers, runtime boundary,
and responsibilities it explicitly does not own.

## Runtime and deployment shape

Describe processes, deployment units, internal responsibilities, runtime entry
points, and why the service-local boundaries exist.

| Runtime unit or module | Responsibility   | Deployment or execution boundary                   | Source   |
| ---------------------- | ---------------- | -------------------------------------------------- | -------- |
| [name]                 | [responsibility] | [process, container, function, worker, or library] | `[path]` |

Link to the repository architecture for cross-service/package relationships.
Add a service-local diagram when internal execution is not clear from the
table.

## Current surfaces and contracts

Link exact native definitions instead of copying large schemas.

| Surface                       | Direction           | Handler or owner | Auth or validation | Compatibility policy    | Source             |
| ----------------------------- | ------------------- | ---------------- | ------------------ | ----------------------- | ------------------ |
| [API, event, command, or RPC] | Provides / Consumes | [owner]          | [policy]           | [stability/deprecation] | `[schema or path]` |

## Dependencies and resilience

| Dependency                           | Used for  | Timeout or retry | Fallback, circuit breaker, or failure propagation |
| ------------------------------------ | --------- | ---------------- | ------------------------------------------------- |
| [service, store, queue, or platform] | [purpose] | [policy]         | [behavior]                                        |

## Data and state

| Entity, store, or state | Ownership                 | Writer             | Migration, retention, or recovery rule |
| ----------------------- | ------------------------- | ------------------ | -------------------------------------- |
| [name]                  | Owned / Shared / External | [module or system] | [rule]                                 |

Document caching, retention, concurrency, and recovery rules when applicable.

## Security and privacy

- Trust boundaries: [actors, networks, or services]
- Authentication and authorization: [mechanism and policy source]
- Secret handling: [approved storage and rotation boundary]
- Data classification: [classification and handling requirements]
- Accepted risks: [link to decision or risk record, or N/A]

## Observability

- Service-level indicators and objectives: [targets and links]
- Logging and tracing: [correlation and privacy rules]
- Alerts and on-call entry point: [links]

## Operating state

| Area                   | Current value or policy      | Source of truth                | Owner or removal condition |
| ---------------------- | ---------------------------- | ------------------------------ | -------------------------- |
| Feature controls       | [flags and defaults, or N/A] | `[system or path]`             | [owner/removal condition]  |
| Limits and quotas      | [limits, or N/A]             | `[configuration or dashboard]` | [owner]                    |
| Compliance obligations | [obligation, or N/A]         | `[policy or evidence]`         | [owner]                    |
| Runbooks and recovery  | [entry point]                | `[runbook or system]`          | [owner]                    |

## Related

- [Repository architecture](architecture.md)
- [Getting started](getting-started.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
