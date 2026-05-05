# Discovery Spec: <Feature Name>

spec_version: 1.0
feature_id: <JIRA-ID or internal ID>
status: Draft|Approved|In-Progress|Done
owner: <team/person>
target_package: <e.g. packages/calling or packages/@webex/plugin-cc>
last_updated_utc: <YYYY-MM-DD>
source_of_truth:
  - <Confluence URL>
  - <JIRA URL>
  - <Prompt summary / meeting notes>
related_specs:
  - <path/to/AGENTS.md>
  - <path/to/ARCHITECTURE.md>
  - <path/to/other/discovery.md>

---

## 1. Executive Summary

### 1.1 Problem

<What problem is being solved>

### 1.2 Outcome

<What changes for users/integrators>

### 1.3 Scope

- In scope:
  - ...
- Out of scope:
  - ...

---

## 2. Inputs and Assumptions

### 2.1 Inputs Used

| Source | Link/Ref | Notes |
|---|---|---|
| Confluence | <url> | |
| Prompt | <text/ref> | |
| Code references | <paths> | |

### 2.2 Assumptions

- A1: ...
- A2: ...

### 2.3 Open Questions

- Q1: ...
- Q2: ...

---

## 3. Current State (As-Is)

### 3.1 Relevant Modules/Files

- `<path>`
- `<path>`

### 3.2 Current Behavior

<Short factual description of existing behavior>

### 3.3 Gaps

- G1: ...
- G2: ...

---

## 4. Target Behavior (To-Be)

### 4.1 User/System Flow

1. ...
2. ...
3. ...

### 4.2 Alternate Flows

- AF1: ...
- AF2: ...

### 4.3 Failure/Retry Behavior

- ...

---

## 5. Contracts to Implement

Use stable IDs for traceability: `REQ-*`, `API-*`, `EVT-*`, `PAY-*`, `ERR-*`, `TEST-*`.

### 5.1 Requirements

| Req ID | Requirement | Priority | Source |
|---|---|---|---|
| REQ-001 | ... | P0/P1/P2 | Confluence section X |

### 5.2 Public API Contract

| API ID | Module | Interface/Class | Method/Property | Signature | Add/Update/No-change | Compatibility |
|---|---|---|---|---|---|---|
| API-001 | ... | ... | ... | ... | Add | Backward compatible |

### 5.3 Event Contract

#### Events Listened

| EVT ID | Consumer | Event Key (enum) | Payload Type | Purpose |
|---|---|---|---|---|

#### Events Emitted

| EVT ID | Emitter | Event Key (enum) | Payload Type | Emission Condition |
|---|---|---|---|---|

#### Ordering/Delivery Rules

- EVT-ORD-001: ...
- EVT-ORD-002: ...

### 5.4 Payload Contract

| PAY ID | Payload Name | Fields | Validation Rules | Notes |
|---|---|---|---|---|
| PAY-001 | ... | ... | ... | ... |

Optional JSON schema block:

```json
{
  "$id": "PAY-001",
  "type": "object",
  "required": ["..."],
  "properties": {}
}
```

### 5.5 Error Contract

| ERR ID | Condition | Error Type/Code | Recoverable | Emitted Event | Caller Action |
|---|---|---|---|---|---|

---

## 6. State and Lifecycle

### 6.1 State Model

`<state1> -> <state2> -> ...`

### 6.2 Transition Rules

| From | Trigger | To | Side Effects |
|---|---|---|---|

### 6.3 Concurrency/Idempotency

- ...

---

## 7. Observability Contract

### 7.1 Logging

| Log ID | Level | Message Pattern | Required Context Fields |
|---|---|---|---|

### 7.2 Metrics

| Metric ID | Name | Trigger | Dimensions |
|---|---|---|---|

---

## 8. Security/Privacy/Compliance

- Data classification:
- Sensitive fields:
- Redaction rules:
- Storage/retention implications:

---

## 9. Implementation Mapping

| Step | File(s) | Change Summary | Contract IDs Covered |
|---|---|---|---|
| 1 | `<path>` | ... | API-001, EVT-002 |
| 2 | `<path>` | ... | PAY-001, ERR-001 |

---

## 10. Test Plan

### 10.1 Unit Tests

| TEST ID | Scenario | Expected Result | Contract IDs |
|---|---|---|---|

### 10.2 Integration Tests

| TEST ID | Scenario | Expected Result | Contract IDs |
|---|---|---|---|

### 10.3 Negative/Chaos Tests

| TEST ID | Scenario | Expected Result | Contract IDs |
|---|---|---|---|

---

## 11. Rollout and Backward Compatibility

- Feature flag:
- Gradual rollout steps:
- Fallback behavior:
- Migration notes for consumers:

---

## 12. Acceptance Criteria (Definition of Done)

- [ ] All `REQ-*` mapped to implementation
- [ ] All `API-*`/`EVT-*`/`PAY-*` finalized
- [ ] Tests for all `TEST-*` pass
- [ ] No unresolved P0/P1 open questions
- [ ] Docs updated in package-level specs

---

## 13. Changelog

| Date (UTC) | Author | Change |
|---|---|---|
| YYYY-MM-DD | <name> | Initial draft |
