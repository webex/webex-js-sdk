<!-- ───────────────────────────────
  Template:     Test Index
  Template-ID:  test-index
  Generates:    ai-docs/TEST_INDEX.md
  Description:  Repo-wide test surface — tiers, commands (by role), directories, frameworks, and coverage gate — routing to where cases live.
  Library ver:  0.2.2
  Last updated: 2026-07-22
─────────────────────────────── -->

# Test Index — <repo name>

> Start here → root [`AGENTS.md`](../AGENTS.md) (agent entry) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md). This doc is the repo-wide map of the test surface.
> Context-efficiency: this is an INDEX, not a case list. It links to where cases live — it does not duplicate them.

<!--
  STANDING reference doc — the one place to understand the whole test surface of the repository: which
  test tiers exist, the command role that runs each, where the tests live, the framework, external
  dependencies, and the enforced coverage/quality gate. It is mirrored from the machine-readable
  `.sdd/manifest.json` (`commands`, `tests`, `quality_gates`) and MUST NOT restate the actual test cases:
    - per-module unit-test detail lives in each module spec's "Test-Case Strategy (module)" section;
    - per-feature/system test detail lives in the feature test strategy at
      `features/<KEY>/test-strategy.md`.
  Headings are flat; sections preceded by `<!-- Include if: ... -->` are kept only when the condition
  holds. Each section comment gives Capture / Avoid / Example. Fill every command/dir/framework from the
  real build config (file path) — never guess.
-->

## Test Surface
<!-- Capture: one row per test tier the repo actually runs, mirrored from the manifest `tests` block and
     `commands` (by role). Name the command by its role so a reader/workflow runs the right one; give the
     directory and framework from the real test setup; list external dependencies the tier needs (e.g.
     containers). Avoid: inventing a tier the repo doesn't have, or defaulting to a web/JS framework when
     the repo isn't web. Example: "Unit | mvn -pl '!test' test | src/test | JUnit 5 | none". -->
| Tier | Command (role) | Test directory | Framework | External deps |
|---|---|---|---|---|
| Unit | `<unit-test cmd>` | `<dir>` | `<framework>` | <none / list> |
| Integration | `<integration-test cmd>` | `<dir>` | `<framework>` | <e.g. docker: postgres, redis> |
| E2E / System | `<e2e cmd>` | `<dir>` | `<framework>` | <deps> |

## Where the Cases Live
<!-- Capture: the routing so a reader finds the actual cases without this doc duplicating them. Avoid:
     copying test cases here. -->
- **Unit test cases** → each module's spec, "Test-Case Strategy (module)" section (see `SPEC_INDEX.md` for the module registry).
- **Integration / E2E / scale / security / resiliency / QA cases** → the per-feature test strategy at `features/<KEY>/test-strategy.md`.

<!-- Include if: the repo enforces a coverage / static-analysis / lint gate -->
## Coverage / Quality Gate
<!-- Capture: the enforced gate, mirrored from the manifest `quality_gates.code_coverage`: the minimum,
     what it measures (Sonar / lint / unit-test coverage), whether it applies to the whole codebase or
     changed lines, and where it is enforced. This gate often lives outside the repo build (Sonar/CI/org
     policy); record it as stated by the repo owner, not a guessed default. Avoid: implying a platform
     default is a repo rule, or claiming a gate the repo doesn't enforce. Example: "≥ 85% (Sonar), changed
     lines, enforced in CI." -->
- Minimum: `<n>%` · Measures: <sonar / lint / unit-test> · Applies to: <whole codebase / changed lines> · Enforced in: <where>.

## QA Dependencies & Environments
<!-- Capture: standing test-environment or external-team dependencies the repo's testing relies on, and
     where manual/QA cases are tracked. Avoid: assuming a test environment is always available. Example:
     "staging bulk-data set for load tests; manual QA cases tracked in the QA tracker project." -->
- <standing test env / external dependency / manual-QA tracker location — or "none">

## Where to Go Next
- Agent entry: `../AGENTS.md` · System shape: `ARCHITECTURE.md` · Routing: `SPEC_INDEX.md`
- Machine source of truth: `.sdd/manifest.json` (`commands`, `tests`, `quality_gates`).
