<!-- sdd-generated-metadata
doc_kind: reference-doc
generated_from: pattern@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-18T15:33:39Z
validation_status: not-run
-->
# Pattern: Typed constants and enum wire values

> Root [`AGENTS.md`](../../AGENTS.md) · router [`SPEC_INDEX.md`](../SPEC_INDEX.md).

## When to use

**When to use:** When declaring a closed set of meeting, event, control, or wire values consumed by TypeScript code.

## Correct

```ts
// from src/meeting/connectionStateHandler.ts
export const ConnectionStateEvent = {
  stateChanged: 'connectionState:changed',
} as const;
export type ConnectionStateEvent = Enum<typeof ConnectionStateEvent>;
```

Use the established `as const` plus `Enum` type pattern or a string enum when the runtime values are part of the protocol.

## Incorrect

```ts
function emitState(name: string) {
  this.emit({}, name, {});
}
```

**Why wrong:** An unconstrained string permits unsupported values and makes refactoring drift from server/event contracts invisible to TypeScript.

## Where it appears

- `src/meeting/connectionStateHandler.ts`, `src/meetings/meetings.types.ts`, `src/annotation/constants.ts`, `src/recording-controller/enums.ts`, `src/reactions/reactions.type.ts`, `src/controls-options-manager/enums.ts`

## Edge cases / exceptions

- Incoming server data is still an untrusted string until validated against the declared values.
- Legacy code sometimes uses raw literals; searches and migrations must include both the typed constant and raw string form before changing behavior.
