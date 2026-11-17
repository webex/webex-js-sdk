# Implementation Plan — T1: V2 Types, Builders & Events

> **Navigation:** [AGENTS.md](../../../../AGENTS.md) → [SPEC_INDEX.md](../../../../SPEC_INDEX.md) → [ARCHITECTURE.md](../../../../ARCHITECTURE.md)

> Plan for [`task-t1.md`](./task-t1.md) under [`epic.md`](./epic.md).

## Task Context
Add the V2 type surface, request builders, event constants, and profile parsing that the rest of the feature builds on. Additive only.

## Current Context (code-grounded)
- `services/agent/index.ts` exposes a `routingAgent` factory with V1 builders.
- `services/agent/types.ts` holds V1 agent types + `AGENT_EVENTS`.
- `services/config/Util.ts#parseAgentConfigs` maps the agent profile to `Profile`.

## Proposed Approach & Sequencing
1. Add V2 types to `services/agent/types.ts` (incl. `SessionVersion`) and V2 `AGENT_EVENTS`.
2. Add V2 request builders to the `routingAgent` factory with centralized endpoint paths.
3. Add V2 `CC_EVENTS`/`CC_AGENT_EVENTS`; add `manageChannelAvailability` to `AgentProfile` + `parseAgentConfigs()`.
4. Export new types from `src/index.ts`.

## API / Interface Changes
New exported types + request builders; see [`../../design/contracts/`](../../design/contracts/).

## Backward-Compat / Rollback
Purely additive; V1 exports and builders unchanged.

## Implementation Caveats
`SessionVersion` lives in `types.ts` (not a separate module). Voice wire value is `telephony`.

## Anticipated PR Split
Part of the single SDK PR (this task is the first commit wave).

## Manual Validation
`yarn build` clean; new types importable.

## AI Docs Impact
Update the `services/agent` module spec Provides/Planned sections.

## References
- [`task-t1.md`](./task-t1.md) · [`../../spec/feature-spec.md`](../../spec/feature-spec.md)

## Logs and Metrics

- Log V2 type registration at debug level during module initialization.
- Log `manageChannelAvailability` parse result in `parseAgentConfigs()` for profile diagnostics.
- No runtime metrics added in this task (types/builders are inert until wired in T2).

## PR Split Strategy

- Single commit wave within the SDK PR: all V2 types, builders, event constants, and profile parsing land together since they form a cohesive, additive surface with no V1 behavioral change.

## Documentation Updates

- Update `services/agent` module spec Provides/Planned sections to list new V2 types and builders.
- Update `services/config` module spec to document the `manageChannelAvailability` profile field and V2 event constants.
