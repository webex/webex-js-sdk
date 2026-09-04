<!-- ───────────────────────────────
  Template:     AGENTS.md
  Template-ID:  agents
  Generates:    AGENTS.md
  Description:  Agent entry contract — first file every AI agent reads (commands, rules, boundaries, routing).
  Library ver:  0.2.2
  Last updated: 2026-07-22
─────────────────────────────── -->

# AGENTS.md — <repo name>

> You are the agent entry point — read first. Next: router [`SPEC_INDEX.md`](ai-docs/SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ai-docs/ARCHITECTURE.md). Load this + `SPEC_INDEX.md` first; pull module/standing docs on demand. (Multi-repo: a workspace-level `AGENTS.md` may sit above this one.)
> Context-efficiency: link to canonical docs — don't duplicate them; keep this file under ~200 lines.

<!--
  ROOT FILE 1 of 3. The agent entry point — first file every automation agent reads. KEEP UNDER
  ~200 LINES — link to ai-docs/SPEC_INDEX.md and module docs instead of
  duplicating. Fill every <...> from REAL repo evidence — never invent commands, paths, flags.
  Headings are flat; sections preceded by `<!-- Include if: ... -->` are kept only when the condition
  holds. Each section comment gives Capture (what to write) / Avoid (the common mistake) / Example.
-->

> Cross-tool context file. Auto-loaded by AI coding agents. If a module ships its own
> `AGENTS.md` agent-entry file, that file layers on top of this root file. (A module's
> high-level design lives in the manifest-routed module spec, source-local as `<module-path>/ai-docs/<module-name>-spec.md` by default, not in an `AGENTS.md`.)

## Repo Overview
<!-- Capture: what the repo is in 1-3 sentences + an is/is-NOT list. Avoid: marketing prose or omitting the
     is-NOT list (it prevents the most common agent misunderstandings). Example: "A service/library that
     owns <domain capability>. It is NOT <adjacent app/system> and does NOT own <external data>." -->
**<repo>** is <one-to-three sentences: what it is>.

**What it is:**
- <bullet>
**What it is NOT:**
- ❌ <bullet>

## Tech Stack
<!-- Capture: language+version, framework, build tool, test frameworks (datastores/messaging only if present).
     Avoid: listing libraries the repo doesn't actually use. Example: "TypeScript 5.4, Node 20, Fastify, Vitest." -->
- <language + version>, <framework>, <build tool>
- <test frameworks; datastores/messaging only if the repo has them>

## Architecture
<!-- Capture: ONE high-level diagram in the shape that fits the repo. Avoid: pasting full detail (that lives in
     ARCHITECTURE.md). Example: a service's request→handler→store flow, or a library's consumer→public-API view. -->
```
<one high-level diagram: a running service → layered/flow; a library → consumer→public-API→internal; a UI → component-tree→state>
```
→ Full repo architecture & component responsibilities: **[ARCHITECTURE.md](./ai-docs/ARCHITECTURE.md)**

## Module / Package Structure
<!-- Capture: an abbreviated tree of the key modules, one line each. Avoid: a full file dump. Example:
     "src/<module-a>/ — <capability>; src/<module-b>/ — <capability>; src/<edge>/ — <entry points>." -->
```
<abbreviated source tree of key modules; one line each>
```
→ Per-module docs and the spec router: **[ai-docs/SPEC_INDEX.md](./ai-docs/SPEC_INDEX.md)**

## Critical Rules
<!-- Capture: the 5-10 non-negotiables drawn from THIS repo's real review corrections; the rule LIST is
     universal, the CONTENT is repo-specific. Avoid: a generic best-practice list. Example: "All <domain unit>
     values use <canonical representation> — never convert implicitly." (network API → validation/authz/resilience; library → semver;
     UI → a11y/design-tokens; plus the repo's real error/format/import idioms.) -->
1. **Code is the source of truth.** Never invent an API, path, event, flag, or constant — read the real file.
2. **Ask before coding.** Present a plan / Spec Summary; wait for confirmation.
3. <rule 3 — a real recurring correction from this repo's reviews>

## Essential Commands
<!-- Capture: the real install/build/test/lint commands, mirrored from the manifest `commands` by role
     (never guessed or copied from another repo). Keep this to the everyday loop; the full command
     surface and test tiers live in `ai-docs/GETTING_STARTED.md` and `ai-docs/TEST_INDEX.md`. Example:
     Install `npm ci` · Test `npm test` · Lint `npm run lint`. -->
| Role | Command |
|---|---|
| Install | `<cmd>` |
| Build | `<cmd>` |
| Unit test | `<cmd>` |
| Lint/format | `<cmd>` |
→ Full command surface, toolchain, and registries: **[GETTING_STARTED.md](./ai-docs/GETTING_STARTED.md)** · test tiers & coverage gate: **[TEST_INDEX.md](./ai-docs/TEST_INDEX.md)**

## Common Gotchas
<!-- Capture: the latent-bug edges (mine incidents + tribal knowledge), each with the failure it causes.
     Avoid: generic advice. Example: "<domain unit> uses <canonical representation>; passing alternate units silently corrupts results." -->
1. <gotcha — specific, with the failure it causes>

## Pre-Commit Checklist
<!-- Capture: the must-pass checks before commit, including a repo-specific item. Avoid: a generic checklist
     that doesn't reflect this repo's gates. Example: add "[ ] <repo-specific invariant> is preserved". -->
- [ ] Tests pass; coverage meets the repo bar
- [ ] Spec/docs updated in the same change (spec-currency)
- [ ] No hardcoded secrets; inputs validated
- [ ] <repo-specific item>

<!-- Include if: the repo uses prompt-mode overrides like /adhoc or /quick -->
## Prompt Overrides (`/adhoc`, `/quick`)
<!-- Capture: the real bypass modes and what each skips. Avoid: implying correctness rules are ever bypassed.
     Example: "/adhoc skips the process scaffold; validation + security rules still apply." -->
- `/adhoc` = full bypass (skip process overhead); `/quick` = partial bypass; correctness rules still apply.

<!-- Include if: the repo's flows depend on external authenticated sources (ticket tracker / wiki / source host / design docs) -->
## External Source Access
<!-- Capture: each non-secret source/provider map the flows depend on + what to do if access is missing.
     Avoid: storing tokens, guessing data a missing server would have provided, or hardcoding one vendor.
     Example: ticket-tracker down → STOP and ask for configuration or pasted source content. -->
| Provider class | Source / host pattern | Preferred access | If unavailable |
|---|---|---|---|
| ticket-tracker | <host/pattern> | connector / cli / rest | STOP and ask — never guess |
| wiki/docs | <host/pattern> | connector / cli / rest / public | STOP and ask or request pasted source |
| source-host | <host/pattern> | connector / cli / rest | STOP and ask |

<!-- Include if: the repo runs automated processes that need guaranteed compliance (strict mode) -->
## Strict Compliance Mode (automation)
<!-- Capture: when strict mode applies and how gates behave. Avoid: leaving "strict" undefined. Example:
     "In CI auto-runs: load all required specs upfront; first violation halts; bounded retries." -->
Load all required specs upfront; verification gates block; stop on first violation. See ai-docs/SPEC_INDEX.md.

---
**SDD coverage:** this repo's per-module coverage state lives in `.sdd/manifest.json` (mirror in
`ai-docs/SPEC_INDEX.md`). Use that state to decide whether the spec is authoritative or code must be cross-checked.
