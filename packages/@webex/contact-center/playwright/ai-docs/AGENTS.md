# Playwright E2E — AI Agent Guide

## Purpose

Usage and workflow guide for AI assistants working on Playwright E2E tests in `@webex/contact-center`. This is the entry point for all E2E test work.

---

## When to Use This Guide

You were routed here because the developer's task was classified as **Type G: E2E Test Work** by the root [`AGENTS.md`](../../AGENTS.md). Follow the templates for implementation.

---

## Quick Reference

### Templates (follow in order)

1. [`ai-docs/templates/e2e/00-master.md`](../../ai-docs/templates/e2e/00-master.md) — Task routing and E2E task types
2. [`ai-docs/templates/e2e/01-pre-questions.md`](../../ai-docs/templates/e2e/01-pre-questions.md) — MANDATORY pre-questions
3. [`ai-docs/templates/e2e/02-test-implementation.md`](../../ai-docs/templates/e2e/02-test-implementation.md) — Implementation paths A-D
4. [`ai-docs/templates/e2e/03-framework-and-doc-updates.md`](../../ai-docs/templates/e2e/03-framework-and-doc-updates.md) — MANDATORY doc updates
5. [`ai-docs/templates/e2e/04-validation.md`](../../ai-docs/templates/e2e/04-validation.md) — Validation & doc sync checklist

### Patterns

- [`ai-docs/patterns/e2e-patterns.md`](../../ai-docs/patterns/e2e-patterns.md) — Test factory, console log verification, multi-agent coordination, timeout selection

### Technical Reference

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — TestManager, Utils, Constants, Console Log Verification, file topology

---

## Common Commands

### Run all E2E tests
```bash
cd packages/@webex/contact-center
npx playwright test
```

### Run a specific test file
```bash
npx playwright test playwright/tests/<test-file>.spec.ts --project=<SET_NAME>
```

### Run a specific suite
```bash
npx playwright test playwright/suites/<suite-file>.spec.ts --project=<SET_NAME>
```

### List all projects/SETs
```bash
npx playwright test --list
```

### Run with repeat for stability check
```bash
npx playwright test <path> --project=<SET_NAME> --repeat-each=5
```

### Run in headed mode for debugging
```bash
npx playwright test <path> --headed
```

### Show Playwright report
```bash
npx playwright show-report
```

---

## Baseline Counts

> Update these counts whenever tests/suites/SETs are added or removed.

| Metric | Count | Last Updated |
|--------|-------|--------------|
| SETs (projects) | 0 | Initial — no tests exist yet |
| Suites | 0 | Initial — no tests exist yet |
| Test files | 0 | Initial — no tests exist yet |
| Utility files | 0 | Initial — no tests exist yet |

---

## Context for New Contributors

This package (`@webex/contact-center`) currently has **zero E2E tests**. The existing browser testing uses WebdriverIO (`wdio.conf.js` at repo root) for the `browser-plugin-meetings` package, not for contact-center.

The Playwright framework documented here is being built as a **migration target**. The ccWidgets repository (`webex/widgets`) has an established Playwright framework with TestManager, Utils, and console log verification patterns. This ccSDK framework mirrors those patterns adapted for SDK-level testing (no UI widgets — the SUT is the vanilla JS sample app at `docs/samples/contact-center/`).
