# E2E Validation Checklist

## Purpose

Final validation before marking an E2E task complete. Covers both test execution and documentation sync.

---

## Test Execution

### Run specific test
```bash
npx playwright test playwright/tests/<test-file>.spec.ts --project=<SET_NAME>
```

### Run specific suite
```bash
npx playwright test playwright/suites/<suite-file>.spec.ts --project=<SET_NAME>
```

### Run all tests for a project/SET
```bash
npx playwright test --project=<SET_NAME>
```

### Stability check (run 5+ times)
```bash
npx playwright test <path> --project=<SET_NAME> --repeat-each=5
```

### List all available projects
```bash
npx playwright test --list
```

---

## Documentation Sync Checklist (MANDATORY)

- [ ] `playwright/ai-docs/ARCHITECTURE.md` file topology matches actual `playwright/` directory
- [ ] `playwright/ai-docs/ARCHITECTURE.md` Set→Suite→Test mapping matches actual suite registrations
- [ ] `playwright/ai-docs/AGENTS.md` baseline counts (SETs, suites, tests) match actual files
- [ ] `ai-docs/patterns/e2e-patterns.md` reflects any new patterns introduced
- [ ] Root `AGENTS.md` service routing table still accurate (Playwright E2E row present)

---

## Final Gate

- [ ] All targeted tests pass
- [ ] No regressions in other tests (run full suite if changes affect shared code)
- [ ] Documentation updated per [`03-framework-and-doc-updates.md`](03-framework-and-doc-updates.md)
- [ ] PR includes both test changes AND doc updates in the same commit
