<!-- ───────────────────────────────
  Template:     Pattern (example)
  Template-ID:  pattern
  Generates:    ai-docs/patterns/<name>.md
  Description:  A repo convention from real code — correct vs incorrect form, with where it appears.
  Library ver:  0.2.2
  Last updated: 2026-06-30
─────────────────────────────── -->

# Pattern: <name>

> Start here → repo root [`AGENTS.md`](../../AGENTS.md) (agent entry) · router [`SPEC_INDEX.md`](../SPEC_INDEX.md). This is an `ai-docs/patterns/` fill-in; the folder README explains generic-vs-per-language routing.
> Context-efficiency: link to canonical docs — don't duplicate them; one small, code-grounded pattern per file.

<!-- Example pattern file shape. Fill these from REAL code (3+ occurrences for a promoted pattern;
     fewer occurrences can be a candidate note, not an enforceable pattern). Delete this example in a
     real repo. Generic patterns sit here; language-specific ones go in a subfolder.
     Each section comment gives Capture / Avoid / Example. -->

## When to use
<!-- Capture: the concrete situation this pattern applies to. Avoid: "always" — give the trigger. Example:
     "When emitting a domain event after a state change." -->
**When to use:** <the situation this pattern applies to>

## Correct
<!-- Capture: the correct form copied from REAL source with a file path anchor. Avoid: an invented snippet.
     Example: "// from events/emit.ts — emit(ev) wraps in the outbox." -->
```<lang>
// from <real/file/path.ext>
<correct example drawn from actual source>
```

## Incorrect
<!-- Capture: the common mistake + the failure it causes. Avoid: a strawman nobody writes. Example: "direct
     bus.publish() — bypasses the outbox, so the event is lost if the tx rolls back." -->
```<lang>
<the common mistake>
```
**Why wrong:** <the failure it causes>

## Where it appears
<!-- Capture: 3+ real file:path occurrences (proves it's a real convention, not invented). Avoid: listing it
     if it appears < 3 times. Example: "<module-a>/emit.ts, <module-b>/emit.ts, <module-c>/emit.ts." -->
- `<file:path>` , `<file:path>` , `<file:path>`  (3+ real occurrences)

## Edge cases / exceptions
<!-- Capture: where the pattern legitimately doesn't apply. Avoid: pretending there are none. Example: "Not for
     fire-and-forget telemetry events, which skip the outbox by design." -->
- <when the pattern legitimately doesn't apply>
