# AGENTS.md — @webex/contact-center

> Read first. Next: [`SPEC_INDEX.md`](ai-docs/SPEC_INDEX.md) · [`ARCHITECTURE.md`](ai-docs/ARCHITECTURE.md). Load the target module spec on demand.

## Repo Overview

`@webex/contact-center` is a published Webex SDK plugin for agent registration, configuration, realtime events, task/call control, data lookup, and telemetry.

**What it is:**
- A TypeScript SDK package embedded in the Webex SDK host.
- A client of Webex Contact Center REST, WebSocket, calling, and metrics services.

**What it is NOT:**
- It is not a standalone backend and owns no durable datastore.
- It does not render a UI; it exposes state and UI-control contracts to host applications.

## Tech Stack

- TypeScript 5.4, Node.js 20+, Yarn 3.4.1, WebexPlugin, EventEmitter, XState 5, WebSocket/WebRTC.
- Jest 27 with 85% global branch/function/line/statement thresholds.

## Architecture

```text
Host Webex SDK → ContactCenter plugin → Services/Task/Metrics → REST + WebSocket + WebRTC backends
```

→ Full architecture: **[ai-docs/ARCHITECTURE.md](./ai-docs/ARCHITECTURE.md)**

## Module / Package Structure

```text
src/                                  public plugin/API orchestration
src/metrics/                          telemetry
src/services/                         service composition and integrations
src/services/{agent,config,core}/     agent, profile, and transport capabilities
src/services/task/                    task/call lifecycle
src/services/task/state-machine/      typed XState lifecycle engine
src/utils/                            pagination/page cache contracts
```

→ Router: **[ai-docs/SPEC_INDEX.md](./ai-docs/SPEC_INDEX.md)**

## Critical Rules

1. Code and tests are the behavioral referee; never invent APIs, paths, events, flags, or states.
2. Ask before coding: present the affected files/contracts and wait for confirmation.
3. Use LoggerProxy with module/method context; never use console logging in package implementation.
4. Use MetricsManager timing/tracking patterns without blocking product behavior.
5. Use typed event constants; preserve `trigger` versus `emit` ownership.
6. Preserve AQM HTTP-plus-WebSocket correlation, timeout, and recovery semantics.
7. Update the owning module spec and contract catalog in the same change as behavior.
8. Run an independent validator runtime for generated or materially changed specs.

## Essential Commands

| Task | Command |
|---|---|
| Install | `yarn install` |
| Build | `yarn workspace @webex/contact-center build:src` |
| Test | `yarn workspace @webex/contact-center test:unit` |
| Lint/format | `yarn workspace @webex/contact-center test:style` |

## Common Gotchas

1. AQM completion may arrive over WebSocket after an HTTP acknowledgement; do not treat the acknowledgement as completion.
2. Listener cleanup requires the same function reference used at registration.
3. Config aggregation is all-or-nothing; returning a partial profile creates inconsistent runtime behavior.
4. Task transitions must go through typed TaskEvent mapping and guards.
5. PageCache bypasses search/filter/attributes/sort queries to avoid stale or incorrect reuse.

## Pre-Commit Checklist

- [ ] Unit tests and lint pass; the 85% coverage bar remains satisfied.
- [ ] Public types/events/methods remain compatible or include a migration plan.
- [ ] State, error, timeout, and cleanup paths are covered.
- [ ] Spec/docs and `.sdd/manifest.json` are updated with code changes.
- [ ] No secrets or sensitive data are committed or logged.

## Strict Compliance Mode (automation)

- Load this file, the router, and only the affected module specs; stop on a blocking contract, security, source-fidelity, or validation finding.

---
**SDD coverage:** `.sdd/manifest.json` is authoritative; `ai-docs/SPEC_INDEX.md` mirrors it.
