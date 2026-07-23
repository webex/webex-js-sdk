# Security Baseline — @webex/calling

> Root [`AGENTS.md`](../AGENTS.md) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Trust Boundaries

| Boundary | Untrusted side | Trusted side | Enforcement |
|---|---|---|---|
| Host application → SDK | caller arguments/config | typed module methods | TypeScript contracts plus runtime validation/guards in owning modules |
| Webex cloud → SDK | HTTP/WebSocket/Mercury payloads | module state and emitted events | transport parsing, status/error handling, correlation and event routing |
| Contact data → consumer | remote contact/SCIM payloads | decrypted contact models | KMS encryption/decryption and field mapping in `src/Contacts/` |
| Credentials → transport | host Webex SDK token | HTTPS/WSS requests | credential access through `src/SDKConnector/` and transport adapters |

## Authentication & Authorization Model

- **Authentication:** the host Webex SDK owns user credentials/token refresh; calling code accesses it through `src/SDKConnector/types.ts` and transport code.
- **Authorization:** remote Webex services enforce user/org entitlements; modules preserve backend errors rather than inventing local authorization.
- **Default posture:** SDKConnector rejects a Webex instance that cannot authorize, is not ready, or lacks Mercury (`src/SDKConnector/utils.ts`).

## Secret & Credential Handling

- Credentials originate from the host Webex SDK; never hardcode, persist, or log them.
- KMS keys/resources are accessed through Webex encryption APIs in `src/Contacts/`.
- Rotation/refresh follows Webex SDK credential behavior; mobius-socket handles token-refresh events through its transport lifecycle.

## Data Classification & Handling

| Data class | Examples | Storage rule | Logging rule | In transit |
|---|---|---|---|---|
| Credentials/secrets | access tokens, KMS key URIs | host SDK/runtime only | never log | TLS/WSS |
| PII | names, phone numbers, emails, caller identity | remote service or process memory; contact fields encrypted as implemented | never log raw payloads | TLS/WSS |
| Call/media metadata | call IDs, correlation IDs, SDP/ROAP, recording metadata | process memory/remote services | log only approved identifiers/context | TLS/WSS |
| Telemetry | operational/behavioral metrics | remote metrics service | no secrets or raw PII | TLS |

## Input Validation & Output Encoding Posture

- Validate caller options, identifiers, dates, URLs, state transitions, and backend responses at the owning module boundary. Preserve typed output/event shapes.

## Transport & Headers

- Remote requests use HTTPS/WSS through Webex SDK or Mobius adapters. Preserve authentication/user-agent/content headers owned by current code; never introduce permissive browser security settings in this library.

## Known Sensitive Areas & Accepted Risks

| Area | Risk | Mitigation | Owner |
|---|---|---|---|
| SDKConnector singleton | replacing/mutating authenticated SDK reference | one-time validated initialization and frozen exported connector | Calling SDK maintainers |
| Contact encryption/SCIM | exposing PII or mishandling keys | KMS-backed encryption plus code-reviewed mappings | Contacts maintainers |
| Mobius token refresh/reconnect | stale/expired token or event loss | explicit auth-close handling, refresh, retry, and reconnect lifecycle | mobius-socket maintainers |
| Logging/metrics | leaking sensitive payloads | contextual logging and approved metric fields only | package maintainers |

## Reporting & Review

- Security-sensitive changes require explicit plan approval and independent review. Follow the parent repository vulnerability-reporting policy and `REVIEW_CHECKLIST.md`.
