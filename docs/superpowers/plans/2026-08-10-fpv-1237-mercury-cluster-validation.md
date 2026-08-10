# FPV-1237 Mercury Cluster Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Mercury events from remapping a service to a cluster owned by another service.

**Architecture:** Validate every pushed `[serviceName, clusterId]` pair against the current ServicesV2 U2C catalog. If any pair is missing or mismatched, discard the entire push and refresh the authoritative catalog.

**Tech Stack:** TypeScript, Ampersand/WebexPlugin, Mocha, Sinon, `@webex/test-helper-chai`, Yarn 3, Node.js 22.14.

## Global Constraints

- Match the production change supplied in the FPV-1237 `fix.patch`.
- Preserve valid migration behavior and existing unknown-cluster refresh behavior.
- Do not modify the Mercury event handler or add dependencies.
- Do not add credentials, tokens, keys, or certificates.

---

### Task 1: Reject cross-service cluster remapping

**Files:**
- Modify: `packages/@webex/webex-core/test/unit/spec/services-v2/services-v2.ts`
- Modify: `packages/@webex/webex-core/src/lib/services-v2/services-v2.ts`

**Interfaces:**
- Consumes: `switchActiveClusterIds(newActiveClusters: ActiveServices): Promise<void>`
- Produces: Validation that only catalog clusters whose `serviceName` matches the map key are applied.

- [ ] **Step 1: Write the failing regression test**

Add this case under `describe('#switchActiveClusterIds')`:

```ts
it('fetches the catalog and does not update active services when id belongs to another service', async () => {
  services._updateActiveServices = sinon.stub();

  await services.switchActiveClusterIds({
    conversation: 'urn:TEAM:me-central-1_d:mercury',
  });

  assert.calledOnceWithExactly(services.initServiceCatalogs, true);
  assert.notCalled(services._updateActiveServices);
});
```

- [ ] **Step 2: Run the targeted test and verify RED**

Run:

```bash
yarn workspace @webex/webex-core test:unit --targets services-v2/services-v2.ts
```

Expected: the new test fails because `_updateActiveServices` is called and `initServiceCatalogs` is not called.

- [ ] **Step 3: Apply the supplied production patch**

Replace ID-only validation with service-aware validation:

```ts
const invalidEntries = Object.entries(newActiveClusters).some(([serviceName, clusterId]) => {
  const service = this._services.find((s) => s.id === clusterId);

  return !service || service.serviceName !== serviceName;
});
```

Use `invalidEntries` to select the existing `initServiceCatalogs(true)` refresh path and update the warning to state that pushed IDs are unknown or do not match their service.

- [ ] **Step 4: Run the targeted test and verify GREEN**

Run:

```bash
yarn workspace @webex/webex-core test:unit --targets services-v2/services-v2.ts
```

Expected: all ServicesV2 unit tests pass.

- [ ] **Step 5: Run package verification**

Run:

```bash
yarn workspace @webex/webex-core test:unit
yarn workspace @webex/webex-core build:src
```

Expected: both commands exit successfully.

- [ ] **Step 6: Commit the fix**

```bash
git add packages/@webex/webex-core/src/lib/services-v2/services-v2.ts \
  packages/@webex/webex-core/test/unit/spec/services-v2/services-v2.ts \
  docs/superpowers/plans/2026-08-10-fpv-1237-mercury-cluster-validation.md
git commit -m "fix(webex-core): validate Mercury cluster migrations"
```
