<!-- sdd-generated-metadata
doc_kind: reference-doc
generated_from: pattern@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-18T15:33:39Z
validation_status: not-run
-->
# Pattern: Defensive error propagation

> Root [`AGENTS.md`](../../AGENTS.md) · router [`SPEC_INDEX.md`](../SPEC_INDEX.md).

## When to use

**When to use:** When request, parser, token, or feature code encounters an invalid input or remote failure that affects the caller's operation.

## Correct

```ts
// from src/breakouts/request.ts
return this.request({
  method: HTTP_VERBS.POST,
  uri: `${url}/message`,
  body: {
    message,
    groups: [params],
  },
}).catch((error) => {
  if (error.body && error.body.errorCode === 201409036 && error.statusCode === 409) {
    LoggerProxy.logger.info(`Breakouts#broadcast --> no joined participants`);
  } else {
    throw error;
  }
});
```

Handle only an explicitly understood exception; otherwise propagate the original/typed error. When parsing a security token, fail conservatively as in `src/interceptors/utils.ts`.

## Incorrect

```ts
return this.request(options).catch(() => undefined);
```

**Why wrong:** It converts every failure into apparent success, hiding authentication, authorization, transport, and server errors and leaving callers with stale state.

## Where it appears

- `src/meetings/request.ts`, `src/meeting/request.ts`, `src/breakouts/request.ts`, `src/interceptors/dataChannelAuthToken.ts`, `src/interceptors/locusRetry.ts`, `src/reachability/index.ts`

## Edge cases / exceptions

- Best-effort reads may intentionally ignore a narrowly scoped optional cache failure, as the join-cookie read does; that exception must not hide the primary network operation.
- Error adapters may wrap a service error in a typed package error, but must retain the original detail needed for diagnostics/recovery.
