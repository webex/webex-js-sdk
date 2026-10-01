---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for [repository name].
tags: [onboarding]
---
<!-- ───────────────────────────────
  Template:     Getting Started
  Template-ID:  getting-started
  Generates:    docs/getting-started.md
  Description:  Resolved from WebexTools/repo-standards templates/docs/getting-started.md
  Library ver:  0.3.0
  Source:       WebexTools/repo-standards@d89a7fe59126ae3ad9bac9ca352aa7f12b4c85dc templates/docs/getting-started.md
  Last updated: 2026-08-24
─────────────────────────────── -->

# Getting started

Onboarding for **[repository name]**. Replace placeholders with verified
repository-local commands and paths.

## Prerequisites

| Tool or access                         | Version or requirement |
| -------------------------------------- | ---------------------- |
| [runtime]                              | [version]              |
| [package manager]                      | [version]              |
| [container, registry, VPN, or account] | [requirement or N/A]   |

## Install

```bash
[clone command]
[install command]
```

## Build

```bash
[build command]
```

## Run

```bash
[run command]
```

## Tests

```bash
[test command]
```

Use the table as the repository-level test router. List only tiers that
actually exist; behavioral intent belongs in the owning module specifications and exact
cases remain in the repository's native test sources.

| Tier         | Command              | Test location | Framework   | External dependencies               |
| ------------ | -------------------- | ------------- | ----------- | ----------------------------------- |
| Unit         | `[verified command]` | `[path]`      | [framework] | None / [dependency]                 |
| Integration  | `[verified command]` | `[path]`      | [framework] | [containers, services, or fixtures] |
| System / E2E | `[verified command]` | `[path]`      | [framework] | [environment or dependency]         |

- Coverage or quality gate: [threshold and scope, or N/A]
- Enforcement source: `[workflow, configuration, or policy]`
- Test environment or QA dependencies: [location/owner, or none]

## Configuration and secrets

- Required configuration: [environment file, config path, or none]
- Secret source: [approved secret manager or local development mechanism]
- Package or artifact access: [registry, credentials flow, or N/A]
- Required neighboring repositories or workspace layout: [paths/order or N/A]
- Platform, simulator, device, or SDK setup: [steps or N/A]
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `[verified startup command]`.
2. Check `[health endpoint, CLI output, or observable result]`.
3. Run `[focused verification command]`.

Expected result: [concrete success signal].

## Next steps

- [Repository architecture](architecture.md)
- [Service specification](service.md) — only when a deployable service exists
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
