# E2E Test Work — Master Template

## Purpose

Orchestrator for all Playwright E2E test work in `@webex/contact-center`. This template routes you through the correct workflow based on the E2E task type.

---

## E2E Task Types

| Code | Task | Description |
|------|------|-------------|
| G1 | New test file | Add a new `.spec.ts` test file to an existing SET |
| G2 | New test suite | Create a new suite that composes test files |
| G3 | New SET | Create a new SET (project) with tests and suites |
| G4 | Fix flaky test | Stabilize an unreliable test |
| G5 | Fix broken test | Fix a test that consistently fails |
| G6 | Update test for SDK change | Modify tests after SDK method/event changes |
| G7 | Add utility | Add a new shared utility to `playwright/utils/` |
| G8 | Update TestManager | Modify TestManager setup/cleanup/convenience methods |
| G9 | Update constants | Add/modify timeout constants, enums, or patterns |
| G10 | Framework config | Modify `playwright.config.ts` or `global-setup.ts` |
| G11 | Understand E2E architecture | Read-only exploration of E2E framework |

---

## Workflow

1. **Ask pre-questions** — Open [`01-pre-questions.md`](01-pre-questions.md). Present every MANDATORY question. Wait for answers.
2. **Implement** — Follow [`02-test-implementation.md`](02-test-implementation.md) for the appropriate implementation path.
3. **Update documentation (MANDATORY)** — Follow [`03-framework-and-doc-updates.md`](03-framework-and-doc-updates.md). This step is NOT optional.
4. **Validate** — Follow [`04-validation.md`](04-validation.md) to confirm tests pass and docs are in sync.

---

## SUT (System Under Test) Reference

The SDK sample app at `docs/samples/contact-center/` is the SUT for E2E tests. It exposes SDK methods via DOM elements that Playwright interacts with. Before writing any test, read the sample app's `app.js` to understand what DOM elements and SDK methods are available.

---

## Key References

- **Framework guide**: [`playwright/ai-docs/AGENTS.md`](../../../playwright/ai-docs/AGENTS.md)
- **Technical reference**: [`playwright/ai-docs/ARCHITECTURE.md`](../../../playwright/ai-docs/ARCHITECTURE.md)
- **E2E patterns**: [`ai-docs/patterns/e2e-patterns.md`](../../patterns/e2e-patterns.md)
