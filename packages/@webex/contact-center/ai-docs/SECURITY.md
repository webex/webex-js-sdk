# Security Baseline — @webex/contact-center

> Start here → root [`AGENTS.md`](../AGENTS.md) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Trust Boundaries

| Boundary | Untrusted side | Trusted side | What is enforced at the crossing |
|---|---|---|---|
| Exported SDK methods | Host application input | ContactCenter/module methods | Typed inputs, runtime validation where implemented, typed errors |
| REST construction | SDK data | Webex request/service routing | Host credentials, service identifier, method/path/payload mapping |
| WebSocket parsing | Remote messages | ContactCenter/Task/AqmReqs | JSON parsing, event-type mapping, correlation/guards |
| Logs/metrics | Runtime data | Remote observability systems | Context selection and no credential/sensitive-data logging |

## Authentication & Authorization Model

- **Authentication:** supplied and maintained by the host Webex SDK (`src/services/core/WebexRequest.ts`).
- **Authorization:** remote WCC services enforce tenant/agent permissions; this package must not bypass host service routing.
- **Default posture:** no standalone credentials or local authorization store.

## Secret & Credential Handling

- Secrets source and injection: host Webex SDK/runtime configuration; never source code.
- Rotation: owned by the host credential system and remote services.
- **Hard rule:** never commit or log secrets, tokens, keys, or connection strings.

## Data Classification & Handling

| Data class | Examples | Storage rule | Logging rule | In transit |
|---|---|---|---|---|
| Identity/PII | agent id/name/email, dial number | ephemeral client memory; remote system of record | do not log raw sensitive values | host-resolved HTTPS/WSS |
| Interaction data | task/customer/call metadata | ephemeral task state; remote system of record | use tracking/interaction ids, minimize payloads | HTTPS/WSS/WebRTC |
| Credentials | access tokens/service auth | host-owned only | never log | HTTPS/WSS |

## Input Validation & Output Encoding Posture

- Validate public inputs before request construction; use typed constants and endpoint builders; never concatenate credentials or executable commands.

## Transport & Headers

- Authenticated requests use the Webex SDK service catalog and HTTPS. Realtime traffic uses host-resolved WSS; header/environment behavior is owned by `src/services/core/WebexRequest.ts` and the host request layer.

## Known Sensitive Areas & Accepted Risks

| Area | Risk | Mitigation / why accepted | Owner |
|---|---|---|---|
| Log upload | Runtime context could contain sensitive values | Shared error helpers upload only approved diagnostic context; never add credentials/payload dumps | Contact Center maintainers |
| WebSocket event parsing | Malformed/unexpected remote data | Parse defensively, map known event constants, ignore/reject invalid transitions | Core/Task maintainers |
| Public dial/contact/participant-drop inputs | PII, external numbers, and participant identifiers | Validate and avoid logging raw values; sensitive AQM operations redact dynamic URLs and raw routing failures | Contact Center maintainers |

## Reporting & Review

- Security-sensitive changes require package-owner review and independent SDD validation. Report vulnerabilities through the repository's documented Cisco security/support process.
