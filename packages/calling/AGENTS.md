# AGENTS.md — @webex/calling

> Agent entry point. Read this file, then [SPEC_INDEX.md](ai-docs/SPEC_INDEX.md) and [ARCHITECTURE.md](ai-docs/ARCHITECTURE.md). Load module specs on demand.

## Repo Overview

`@webex/calling` is the published TypeScript calling SDK package inside the Webex JS SDK workspace. It exposes consumer factories, types, helpers, and events through `src/index.ts` and implements backend-specific calling behavior under `src/`.

**What it is:**
- A client library for calling registration, call control/media, history, recording, settings, contacts, voicemail, telemetry, and Mobius WebSocket signaling.

**What it is NOT:**
- It is not a backend service and does not own Webex service data.
- It does not own a database; browser local storage is transient client state/configuration.

## Tech Stack

- TypeScript 4.9, Node.js 18, Yarn 3 workspaces, XState, WebSocket, async-mutex.
- Jest unit tests, ESLint/Prettier, TypeDoc, and Playwright end-to-end tests.

## Architecture

```text
Consumer → src/index.ts → Calling clients/factories → backend connectors and shared infrastructure
                                               ├→ Webex HTTP services
                                               ├→ Mercury events
                                               └→ Mobius WebSocket + media
```

See [ARCHITECTURE.md](ai-docs/ARCHITECTURE.md).

## Module / Package Structure

```text
src/CallHistory/                    # call-history records and events
src/CallRecording/                  # recording records, metadata, deletion, events
src/CallSettings/                   # WXC/UCM calling settings
src/CallingClient/                  # initialization, lines, recovery, coordination
src/CallingClient/calling/          # calls, media, transfers, state machines
src/CallingClient/calling/CallerId/ # identity resolution and SCIM enrichment
src/CallingClient/line/             # line lifecycle and call creation
src/CallingClient/registration/     # registration, keepalive, failover/failback
src/Contacts/                       # contacts/groups, encryption, SCIM resolution
src/Metrics/                        # typed telemetry submission
src/Voicemail/                      # WXC/UCM/Broadworks voicemail
src/mobius-socket/                  # WebSocket lifecycle, requests, async events
```

Canonical routes: [SPEC_INDEX.md](ai-docs/SPEC_INDEX.md).

## Critical Rules

1. `src/index.ts` is the consumer-facing boundary; do not present non-exported implementation symbols as supported public API.
2. Read the owning module spec before changing behavior; update code and its spec in the same change.
3. Use `src/Logger`, never `console.*`; include `file` and `method` context and never log tokens or sensitive payloads.
4. Use typed events from `src/Events/types.ts`; update event maps, emission, docs, and tests together.
5. Use the error hierarchy under `src/Errors`; log and emit caller-visible failures instead of swallowing them.
6. Preserve backend distinctions among WXC, UCM, and Broadworks; unsupported operations must retain their documented response behavior.
7. Keep tests co-located as `*.test.ts`; cover success, failure, events, cleanup, and retry/state edges.
8. Do not invent endpoints, constants, timers, payloads, or compatibility guarantees—use the defining source file.

## Essential Commands

| Task | Command |
|---|---|
| Install | `yarn install` |
| Build | `yarn workspace @webex/calling build` |
| Unit tests | `yarn workspace @webex/calling test:unit` |
| Lint | `yarn workspace @webex/calling test:style` |
| Docs | `yarn workspace @webex/calling build:docs` |
| E2E | `yarn workspace @webex/calling test:e2e` |

## Common Gotchas

1. Calling backends support different operations; a WXC flow cannot be assumed to work for UCM or Broadworks.
2. Calling and registration are stateful and asynchronous; cleanup, retry timers, late events, and network recovery must be tested.
3. Mobius can carry both request responses and unsolicited events; correlation, deduplication, close-code behavior, and token refresh are separate concerns.
4. Registration failover state in `localStorage` is transient and keyed by user; it is not durable package data.
5. Contacts cache encrypted data and may require SCIM enrichment; cache updates and resolution failures must preserve documented semantics.

## Pre-Commit Checklist

- [ ] Build, unit tests, and style checks pass for the package.
- [ ] Public export/event/type changes are reflected in `ai-docs/CONTRACTS.md`.
- [ ] Owning module spec and diagrams match changed behavior.
- [ ] Backend-specific, error, metric, cleanup, and retry cases are covered.
- [ ] No secrets, access tokens, phone data, or sensitive payloads are logged.

## Prompt Overrides (`/adhoc`, `/quick`)

No package-specific prompt bypass is defined. If a runtime accepts `/adhoc` or `/quick`, it may reduce process narration but must not bypass correctness, security, tests, spec-currency, or validation.

## External Source Access

| Provider class | Source / host pattern | Preferred access | If unavailable |
|---|---|---|---|
| source host | Webex GitHub repositories and PR history | configured connector or CLI | use local code/tests; ask before relying on unavailable history |
| backend docs | Webex service documentation | configured docs connector or pasted source | do not guess endpoints or contracts |
| ticket tracker | team Jira project | configured connector or pasted ticket | ask for required acceptance context |

## Strict Compliance Mode (automation)

Automated changes must load the routed module spec, keep public contracts and specs current, and stop on build, test, lint, conformance, drift, or validator failures.

---

Coverage state is authoritative in `.sdd/manifest.json` and mirrored in `ai-docs/SPEC_INDEX.md`.
