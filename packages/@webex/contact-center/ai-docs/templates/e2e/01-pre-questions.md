# E2E Pre-Questions — MANDATORY Before Implementation

## Purpose

These questions MUST be answered by the developer before any E2E implementation begins. Do not infer or assume answers.

---

## Section 1: Task Identification (MANDATORY)

1. **What is the E2E task type?** (G1–G11 from `00-master.md`)
2. **Which SET does this belong to?** (existing SET name, or "new SET" if G3)
3. **What is the test/suite name?** (descriptive name for the new/modified test)

---

## Section 2: SDK Methods Under Test (MANDATORY for G1, G2, G3, G6)

4. **Which SDK methods will this test exercise?**
   - List the exact method names from `cc.ts` or service files (e.g., `cc.stationLogin()`, `task.hold()`)
   - These methods must exist in the sample app's `app.js` as callable DOM actions

5. **What SDK events should be verified?**
   - List events the test should capture via console log verification (e.g., `WXCC_SDK_AGENT_STATE_CHANGE_SUCCESS`)
   - These must match the patterns in `constants.ts` → `CONSOLE_PATTERNS`

6. **What is the expected state flow?**
   - Describe the sequence: initial state → action → expected state (e.g., `Available → incoming task → Engaged → end task → Available`)

---

## Section 3: Test Environment (MANDATORY for G1, G2, G3)

7. **How many agents are needed?**
   - Single agent (agent1 only) or multi-agent (agent1 + agent2)?
   - Does the test need a caller page? Extension page? Chat page?
   - Map to `SetupConfig` options: `needsAgent1`, `needsAgent2`, `needsCaller`, `needsExtension`, `needsChat`

8. **What login mode?**
   - Desktop (default), Extension, or Dial Number?
   - Map to `SetupConfig.agent1LoginMode`

---

## Section 4: Stability Context (MANDATORY for G4, G5)

9. **What is the failure symptom?**
   - Exact error message or screenshot
   - Frequency: always fails, fails ~X% of runs, fails only in CI

10. **What has been tried already?**
    - Timeout increases? (If so, which timeouts and to what values?)
    - Retry additions? Selector changes?

---

## Section 5: Framework Changes (MANDATORY for G7, G8, G9, G10)

11. **What is the change?**
    - Exact description of what to add/modify in the utility, TestManager, constants, or config

12. **Which existing tests will be affected?**
    - List tests/suites that use the component being modified
    - Confirm: should existing tests continue to work unchanged (backward compatible)?

---

## Core Principles (apply to all answers)

- **Root cause over timeout increase**: If a test is flaky, find the root cause. Increasing timeouts is a last resort, not a fix.
- **No lazy reasoning**: "It probably works" is not acceptable. Verify with actual code references.
- **Timeout justification required**: If a timeout value is chosen, explain why that specific duration (reference `ARCHITECTURE.md` timeout hierarchy).
- **Console log verification is primary**: SDK E2E tests verify behavior via console output, not UI state. Design tests around `CONSOLE_PATTERNS`.
