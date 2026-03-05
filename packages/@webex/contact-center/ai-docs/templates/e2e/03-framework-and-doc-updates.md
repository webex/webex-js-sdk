# Framework and Documentation Updates — MANDATORY

## Purpose

This step is **MANDATORY**, not optional. Every E2E task that modifies files must verify and update the Playwright ai-docs to stay in sync.

---

## When to Update What

| Change Type | Files to Update |
|---|---|
| New test file added | ARCHITECTURE.md (file topology, Set→Suite→Test mapping) |
| New suite added | ARCHITECTURE.md (file topology, Set→Suite→Test mapping), AGENTS.md (baseline counts) |
| New SET added | ARCHITECTURE.md (file topology, Set→Suite→Test mapping), AGENTS.md (baseline counts), `playwright.config.ts` |
| New utility added | ARCHITECTURE.md (Utils reference table) |
| New constant/timeout added | ARCHITECTURE.md (Constants section, timeout hierarchy) |
| TestManager changed | ARCHITECTURE.md (TestManager section — SetupConfig, convenience methods, or cleanup) |
| Console pattern changed | ARCHITECTURE.md (Console Log Verification Pattern section) |
| Flaky test fixed | AGENTS.md (if stability pattern is reusable, add to known patterns) |
| SDK change updated tests | ARCHITECTURE.md (if SUT interface changed) |

---

## Update Checklist

### ARCHITECTURE.md (`playwright/ai-docs/ARCHITECTURE.md`)

- [ ] **File Topology**: All new/renamed/deleted files reflected in the tree
- [ ] **Set→Suite→Test Mapping**: Table matches actual suite registrations
- [ ] **TestManager Section**: SetupConfig options, page properties, convenience methods are current
- [ ] **Utils Reference Table**: All utility files listed with method signatures
- [ ] **Constants Section**: All enums, timeout values, and console patterns are current
- [ ] **Timeout Hierarchy**: New timeouts placed at correct level

### AGENTS.md (`playwright/ai-docs/AGENTS.md`)

- [ ] **Baseline Counts**: SET count, suite count, test count match actual files
- [ ] **Common Commands**: Any new run configurations documented

### e2e-patterns.md (`ai-docs/patterns/e2e-patterns.md`)

- [ ] **New reusable pattern**: If the task introduced a pattern other tests should follow, add it
- [ ] **Anti-patterns**: If the task fixed a bad pattern, add it to anti-patterns section
