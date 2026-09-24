<!-- ───────────────────────────────
  Template:     Rule (example)
  Template-ID:  rule
  Generates:    ai-docs/rules/<name>.md
  Description:  One enforceable repo rule — the rule, its rationale, how to follow it, and how it's enforced.
  Library ver:  0.2.2
  Last updated: 2026-06-30
─────────────────────────────── -->

# Rule: <short imperative name>

> Start here → repo root [`AGENTS.md`](../../AGENTS.md) (agent entry, carries the critical rules) · router [`SPEC_INDEX.md`](../SPEC_INDEX.md). This is an `ai-docs/rules/` fill-in; the folder README explains generic-vs-per-language routing; the repo-wide rules digest is `RULES.md`.
> Context-efficiency: link to canonical docs — don't duplicate them; one rule per file; defer to the linter where it enforces.

<!--
  A single fill-in rule file (symmetric with patterns/_pattern-example.md). Generic rules live in
  ai-docs/rules/; language-specific rules in ai-docs/rules/<language>/. One rule per file. Defer to tooling:
  if a linter/CI already enforces it, point to that instead of restating it.
-->

## Rule
<!-- Capture: the rule as one imperative sentence the agent can obey. Avoid: vague aspirations
     ("write clean code") or generic best practice not specific to this repo. Example: "Wrap every
     outbound network call in the shared retry helper; never call the HTTP client directly." -->
<the rule>

## Why
<!-- Capture: the concrete reason — the incident, bug class, or convention it prevents. Avoid: "it's
     best practice" with no consequence. Example: "Direct client calls bypass timeout + circuit-breaker
     config and caused a cascading outage (INC-1234)." -->
<rationale>

## How to follow
<!-- Capture: the correct way, with a real code reference (file path) or a short snippet. Avoid: an
     abstract description with no example to copy. Example: "Use retryingClient.call(req) — see
     src/net/retrying-client.ts." -->
<how + example reference>

## Enforced by
<!-- Capture: the exact gate that catches a violation. Avoid: claiming enforcement that doesn't exist.
     Example: "lint rule no-direct-http (errors in CI)" or "review only — no automated check yet." -->
<linter rule / CI gate / review check / "review only">
