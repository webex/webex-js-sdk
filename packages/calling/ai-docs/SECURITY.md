# Security Baseline — @webex/calling

## Trust Boundaries

Consumer applications, browser state, Webex SDK inputs, network responses, Mercury events, and Mobius frames cross trust boundaries. Validate shapes and route failures through typed errors/results.

## Authentication & Authorization Model

The initialized Webex SDK owns user identity and tokens. HTTP and WebSocket layers consume those credentials; this package does not mint identities or authorize server-side resources.

## Secret & Credential Handling

Never hardcode or log access tokens, refresh tokens, test credentials, WebSocket authorization material, or private endpoints. Use approved environment/CI secret injection.

## Data Classification & Handling

Call identifiers, phone numbers, contact details, recordings, voicemail, transcripts, and diagnostic payloads may be sensitive. Log only the minimum operational context. Preserve Contacts encryption behavior.

## Input Validation & Output Encoding Posture

Use typed payloads, backend-specific validation, guarded optional fields, and documented parsing for SIP/XML/JSON/WebSocket inputs. Do not render remote strings without host-application encoding.

## Transport & Headers

Use HTTPS/WSS endpoints and existing request helpers. Preserve required Webex headers and never add credentials to URLs or logs.

## Session & Cookie Posture

The package owns no cookie session. Registration localStorage entries are transient recovery/configuration state; keys and cleanup must remain scoped and must not store tokens.

## Known Sensitive Areas & Accepted Risks

- Log upload and telemetry can carry diagnostic context; filters and typed metric payloads must remain intact.
- CallerId/Contacts use remote identity data; lookup failures must degrade safely without exposing raw payloads.
- Mobius authorization refresh and close-code handling are security-sensitive and require negative tests.

## Reporting & Review

Security-sensitive changes require explicit review, tests for failure paths, updates to this baseline and the owning module spec, and no unresolved high-severity findings.
