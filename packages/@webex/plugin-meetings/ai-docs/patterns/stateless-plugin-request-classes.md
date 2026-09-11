<!-- sdd-generated-metadata
doc_kind: reference-doc
generated_from: pattern@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-18T15:33:39Z
validation_status: not-run
-->
# Pattern: Stateless plugin request classes

> Root [`AGENTS.md`](../../AGENTS.md) · router [`SPEC_INDEX.md`](../SPEC_INDEX.md).

## When to use

**When to use:** When a meeting capability needs a focused authenticated Webex HTTP boundary that does not own the feature's domain state.

## Correct

```ts
// from src/meetings/request.ts
export default class MeetingRequest extends StatelessWebexPlugin {
  getActiveMeetings() {
    return this.request({
      api: API.LOCUS,
      resource: RESOURCE.LOCI,
    });
  }
}
```

Keep state and event orchestration in the owning controller; the request class builds the request and returns/rejects its promise.

## Incorrect

```ts
class BreakoutController {
  broadcast(url, body) {
    return fetch(url, {method: 'POST', body: JSON.stringify(body)});
  }
}
```

**Why wrong:** This bypasses the Webex host request pipeline, credentials, interceptors, service routing, established errors, and test seams.

## Where it appears

- `src/meetings/request.ts`, `src/meeting/request.ts`, `src/breakouts/request.ts`, `src/members/request.ts`, `src/personal-meeting-room/request.ts`, `src/roap/request.ts`

## Edge cases / exceptions

- A helper may hold an injected Webex object without extending `StatelessWebexPlugin` when existing code does so, as in `src/reachability/request.ts`; it must still use `webex.request` and remain transport-focused.
- Debounce or a weak meeting reference may live in a request helper when it is required to build/serialize requests, but feature state stays in the controller.
