# E2E Test Implementation

## Purpose

Implementation guide for Playwright E2E tasks. Choose the path matching your task type.

---

## Path A: New Test File (G1)

1. **Create test file** in `playwright/tests/` following the test factory pattern:
   ```typescript
   import {test, expect} from '@playwright/test';
   import {TestManager} from '../test-manager';

   export default function createYourTests() {
     let tm: TestManager;

     test.beforeAll(async ({browser}, testInfo) => {
       tm = new TestManager(testInfo.project.name);
       await tm.setup(browser, {
         needsAgent1: true,
         // ... SetupConfig options from pre-questions
       });
     });

     test.afterAll(async () => {
       await tm.cleanup();
     });

     test('descriptive test name', async () => {
       // 1. Action: interact with SUT via page
       // 2. Verify: check console messages or page state
     });
   }
   ```

2. **Register in suite** — Import and call the factory in the appropriate suite file:
   ```typescript
   import createYourTests from '../tests/your-test.spec';
   test.describe('Your Test Suite', createYourTests);
   ```

3. **Follow patterns** from [`e2e-patterns.md`](../../patterns/e2e-patterns.md) — especially console log verification and timeout selection.

---

## Path B: New Suite / New SET (G2, G3)

1. **Create suite file** in `playwright/suites/` that imports and composes test factories:
   ```typescript
   import {test} from '@playwright/test';
   import createTestA from '../tests/test-a.spec';
   import createTestB from '../tests/test-b.spec';

   test.describe('Suite Name', () => {
     test.describe('Test A', createTestA);
     test.describe('Test B', createTestB);
   });
   ```

2. **For new SET (G3)**: Add a project entry to `playwright.config.ts` that maps `USER_SETS` env var to the new SET name and suite.

3. **Update ARCHITECTURE.md** — Add the new SET/suite to the Set→Suite→Test mapping table.

---

## Path C: Fix Flaky/Broken Test (G4, G5)

1. **Reproduce** — Run the specific test in isolation: `npx playwright test <file> --project=<SET>`
2. **Investigate root cause** — Check:
   - Race condition (missing `waitFor` or event)
   - Selector instability (dynamic IDs vs. `data-testid`)
   - Timeout too short (reference timeout hierarchy in ARCHITECTURE.md)
   - State leakage from previous test (cleanup issue)
3. **Fix** — Address root cause. Do NOT just increase timeouts unless justified.
4. **Verify** — Run 5+ times to confirm stability: `npx playwright test <file> --project=<SET> --repeat-each=5`

---

## Path D: Update for SDK Change (G6)

1. **Identify affected tests** — Grep for the changed SDK method/event across `playwright/tests/` and `playwright/utils/`
2. **Update test logic** — Modify assertions, setup, or teardown to match new SDK behavior
3. **Update SUT if needed** — If the SDK method signature changed, update `docs/samples/contact-center/app.js`
4. **Run full regression** — `npx playwright test` to verify no other tests broke

---

## Done Criteria

- [ ] Tests pass locally: `npx playwright test <file> --project=<SET>`
- [ ] No hardcoded timeouts without justification (use constants from `constants.ts`)
- [ ] Console log verification pattern used for SDK event assertions
- [ ] Test factory pattern followed (exported default function, not inline)
- [ ] **AGENTS.md baseline updated** — suite/SET counts match actual files
- [ ] **ARCHITECTURE.md file topology updated** — new files appear in mapping tables
- [ ] Proceed to [`03-framework-and-doc-updates.md`](03-framework-and-doc-updates.md)
