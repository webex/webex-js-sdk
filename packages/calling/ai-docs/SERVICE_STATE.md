# Service State (living) — @webex/calling

## Current Endpoints

Endpoints are defined in module `constants.ts` and backend connectors. Families include discovery/device, Mobius registration/call/media/supplementary services, Hydra People calling settings, XSI Actions, contacts/groups/SCIM, Janus history, converged recordings, and WXC/UCM/Broadworks voicemail.

## Current Events

Consumer events are defined in `src/Events/types.ts`; internal Mobius events and recording/history Mercury events are documented in their module specs and `CONTRACTS.md`.

## Data Stores

No datastore is owned. In-memory caches/collections and transient registration or feature-override localStorage are client state, not systems of record.

## External Dependencies

Webex SDK plugins, Webex calling/people/history/recording/voicemail services, Mercury, Mobius WebSocket, and media packages. Exact package versions are in `package.json`.

## Rate Limits & Quotas

HTTP 429 and retry-after handling is module-specific. No package-wide quota value is defined; never invent one.

## Key Metrics & Performance Targets

Typed registration, call, media, connection, voicemail, discovery, and log-upload metrics are defined under `src/Metrics`. No numeric package SLO was found in approved evidence.

## Feature Flags (current)

Mobius WebSocket calling uses the Webex feature service with a restricted sample-page localStorage override. Other configuration is defined by module config/types and backend detection.

## Compliance / Certifications

No package-specific certification claim was found. Follow repository security, privacy, dependency, and release controls.

## Maintenance

Update this living registry with endpoint families, events, external dependencies, metrics, and flags whenever their defining source changes.
