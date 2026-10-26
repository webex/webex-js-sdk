---
type: ADR
title: ADR-0001 - Self-contained plugin with a flattened container response
description: Keep the plugin self-contained, flatten the Pragya container response, and treat Pragya as the source of truth for content URLs and keys.
tags: [adr]
timestamp: 2026-09-23T00:00:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: "@riag"
updated_at: 2026-09-23T14:03:22Z
validation_status: pass
-->

# ADR-0001 - Self-contained plugin with a flattened container response

| Field         | Value                                         |
| ------------- | --------------------------------------------- |
| Status        | Accepted                                      |
| Decision date | 2026-09-23                                    |
| Deciders      | Webex JS SDK Team                             |
| Supersedes    | N/A                                           |
| Superseded by | N/A                                           |

## Context

The SDK needed to expose AI-generated call summaries without disturbing the existing call-history
and bundle packages. Container IDs arrive from Janus, but the content URLs and the decryption key
are owned by Pragya, and Pragya's response shape does not match what consumers want to read. These
decisions were recorded with the original feature design and are reconstructed here from that
design material together with the shipped implementation in `src/ai-summary.ts`.

## Decision

Four choices were made together:

- **Self-contained plugin with zero changes to existing packages.** The plugin owns all of its types, constants, and logic. It does not modify `UserSession`, `CallHistory`, or the `packages/webex` bundle.
- **Flatten the container response.** `getContainer()` lifts `summaryData.data` onto `summaryData` so consumers can read `summaryData.summaryUrl` directly.
- **No separate service discovery for summary endpoints.** Pragya returns fully-qualified URLs that already include the correct regional host. The SDK fetches from these URLs directly.
- **Pragya is the source of truth** for both the content URLs and the encryption key.

Pragya is discoverable via U2C as `serviceName: "pragya"` (validated: e.g., load-us resolves to `https://pragya-loada.ciscospark.com/pragya/api/v1`).

This plugin is fully self-contained. It does **not** require modifications to any existing package:

| Concern | Approach |
| ------- | -------- |
| `UserSession` type in `@webex/calling` | **Not modified.** The plugin accepts a plain `containerId: string`. Consumers extract it from the Janus response at the application layer. The `UserSession` type update is a separate, optional task for the calling package team. |
| `packages/webex` bundle | **Not modified.** Consumers import `@webex/internal-plugin-call-ai-summary` directly, which self-registers via `registerInternalPlugin`. |
| `@webex/internal-plugin-encryption` | **Not modified.** Used as a runtime dependency via `this.webex.internal.encryption.decryptText()`. |

A related consequence of the same shape: `getSummary()` retrieves note, short note, and action items
in a single request with `?fields=note,shortnote,actionitems`, which is why it is the recommended
entry point over the standalone `getNotes()` and `getActionItems()` methods.

## Why

Modifying `UserSession` or the bundle would have coupled an experimental internal plugin to widely
consumed packages. Flattening the response keeps the awkward upstream nesting out of every consumer.
Trusting Pragya's absolute URLs avoids a second discovery mechanism that could disagree with Pragya
about the correct region.

## Alternatives considered

The non-modification choices recorded in the Decision table above were each weighed against
extending the existing package instead. The remaining alternatives:

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Return the raw Pragya body unchanged | Pushes the `summaryData.data` nesting onto every consumer |
| Resolve content endpoints through the service catalog | Pragya already returns region-correct absolute URLs; a second mechanism could disagree |
| Require three standalone calls for note, short note, and action items | Costs three round trips and breaks when the optional `notesUrl` or `actionItemsUrl` is absent |

## Consequences

**Positive:**

- Zero changes to existing packages; the plugin ships and versions independently.
- Consumers read `summaryData.summaryUrl` without knowing the upstream shape.
- Region correctness comes from Pragya for free.
- One request returns all three summary content types.

**Negative / tradeoffs:**

- The object returned by `getContainer()` no longer matches the raw Pragya wire body, so wire-level debugging must account for the transform.
- The module trusts absolute URLs supplied by an upstream response.
- Type definitions overlap conceptually with neighbouring plugins and must be maintained in parallel.
- Callers wanting a single content type still pay for the combined `getSummary()` response.

## Constraint on future changes

`getContainer()` must keep flattening `summaryData.data` onto `summaryData` while consumers depend on
the flattened shape; changing it is a breaking change to every caller. The plugin must remain free of
edits to `UserSession`, `CallHistory`, and the `packages/webex` bundle.

## Follow-up

- [ ] Add unit tests covering the flattening transform and the `keyUrl` precedence rule
- [ ] Confirm whether `notesUrl` and `actionItemsUrl` are now present in all Pragya API versions
- [x] Record an owner answer for the package's coverage gate — resolved 2026-09-23: no gate applies, recorded as `quality_gates.code_coverage.origin: none`

## Revisit when

- Pragya stops nesting URLs under `summaryData.data`, making the transform a no-op
- The standalone notes and action-item endpoints become universally available
- A consumer needs the raw, untransformed container body

## References

- [Repository architecture](../architecture.md)
- [Module specification](../../src/docs/README.md)
- `src/ai-summary.ts`
