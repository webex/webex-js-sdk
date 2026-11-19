---
type: ADR
title: ADR-0001 - Retain the product README
description: SDD onboarding keeps README.md as product documentation and routes it only as context.
tags: [adr]
timestamp: 2026-11-12T08:36:43Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T09:22:36Z
validation_status: pass-with-warnings
-->

# ADR-0001 - Retain the product README

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-11-12 |
| Deciders      | rarajes2@cisco.com (bootstrap questionnaire) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

Onboarding found one existing document, `README.md`. It is the npm usage page: an install command, an
import example, method examples, and a list of events. No other intent, design, or AI-authored spec
exists in this package.

Several of its claims no longer match the code:

| README claim | Code |
| ------------ | ---- |
| `webex.internal.voicea.registerAndConnect(locusUrl, datachannelUrl)` connects voicea, using the LLM plugin internally | No such method exists. `webex.internal.voicea` has only `createChannel(llmChannel?)` (`src/voicea-plugin.ts`); the caller connects the LLM channel and binds it with `switchLLMChannel` (`src/voicea.ts`) |
| Methods are called on `webex.internal.voicea` | They are methods of the `VoiceaChannel` that `createChannel` returns (`src/voicea.ts`) |
| "Toggle Captions" calls `toggleTranscribing(true)` and `toggleTranscribing(false)` | Captions are turned on by `turnOnCaptions`; `toggleTranscribing` changes transcription and turns captions on only when activating (`src/voicea.ts`) |
| `setSpokenLanguage` triggers `voicea:spokenLanguageSet` | It emits `voicea:spokenLanguageUpdate` (`src/constants.ts`) |
| The event list | It omits `voicea:spokenLanguageUpdate`, `voicea:speakerNameUpdated`, `voicea:languageDetected`, and `aibridge:newManualCaption` (`src/constants.ts`) |

## Decision

Keep `README.md` unchanged. Do not migrate it into the module specification. Record
`spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition` `retain`, and route
`README.md` in `spec_sources` as `reference-only` and `context-only`.

The canonical behavior is `src/` plus `test/`. Where the README differs from code, code wins and the
module specification follows code.

## Why

The README is the npm-facing page. Correcting it is a product-doc change, not a requirement of making
the package SDD-ready, and every other onboarded package in this workspace kept its README the same
way. The module specification already records the current methods and events, so nothing in the
README needs to be preserved by migration.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Migrate the README into `src/docs/README.md` and delete it | Its behavioral claims are stale, so migrating them would carry wrong content; deletion was not requested |
| Reconcile the README with the module specification in place | Reconciling would preserve stale wording in the canonical spec; the developer chose `keep-separate` |
| Correct the README during onboarding | Onboarding writes the SDD tree only and does not edit `README.md` |

## Consequences

**Positive:**

- The npm page stays stable for consumers.
- The module specification is the single behavioral reference.

**Negative / tradeoffs:**

- Agents must not treat `README.md` as the list of methods, events, or the connection flow.
- The stale README remains until a maintainer makes a separate product-doc change.

## Constraint on future changes

Do not delete `README.md` as part of spec maintenance. If its usage text changes, keep the module
specification aligned with code rather than with the README.

## Follow-up

- [ ] A maintainer may correct the README usage section in a separate product-doc change.

## Revisit when

- A maintainer rewrites the README to document `createChannel` and the `VoiceaChannel` API.

## References

- `README.md`
- `src/index.ts`
- `src/voicea-plugin.ts`
- `src/voicea.ts`
- `src/constants.ts`
- `.sdd/manifest.json` `spec_source_policy`
