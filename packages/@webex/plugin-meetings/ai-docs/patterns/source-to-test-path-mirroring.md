<!-- sdd-generated-metadata
doc_kind: reference-doc
generated_from: pattern@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-18T15:33:39Z
validation_status: not-run
-->
# Pattern: Source-to-test path mirroring

> Root [`AGENTS.md`](../../AGENTS.md) · router [`SPEC_INDEX.md`](../SPEC_INDEX.md).

## When to use

**When to use:** When locating or adding package unit tests for a source module.

## Correct

```text
src/locus-info/controlsUtils.ts
test/unit/spec/locus-info/controlsUtils.js

target: locus-info/controlsUtils.js
```

Mirror the source area below `test/unit/spec/`, then pass a target relative to that spec directory.

## Incorrect

```text
target: controlsUtils.js
target: packages/@webex/plugin-meetings/test/unit/spec/locus-info/controlsUtils.js
```

**Why wrong:** A bare filename loses the subdirectory and a repository-relative path violates the runner's target-root contract, so the intended test may not run.

## Where it appears

- `src/meeting/index.ts` ↔ `test/unit/spec/meeting/index.js`, `src/meetings/request.ts` ↔ `test/unit/spec/meetings/request.js`, `src/breakouts/index.ts` ↔ `test/unit/spec/breakouts/index.ts`, `src/interceptors/dataChannelAuthToken.ts` ↔ `test/unit/spec/interceptors/dataChannelAuthToken.ts`

## Edge cases / exceptions

- Some legacy test extensions differ from source (`.ts` versus `.js`); mirror the directory and behavior, not necessarily the extension.
- Shared fixture/helper files may live under `test/unit/spec/fixture/` or the nearest suite rather than mirroring a production file.
