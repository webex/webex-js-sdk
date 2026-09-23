<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: service-state@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-18T15:33:39Z
validation_status: not-run
-->
# SERVICE STATE — @webex/plugin-meetings

## Current Endpoints

This package owns no endpoint. Current request families are device registration, active meetings/preferences/geo hints, meeting-info/static links, Locus lifecycle and controls, media/ROAP/TURN, member mutations, breakouts, interpretation/AI/webinar/recording, PMR, reachability, and metrics. Exact URLs are resolved by request helpers and Webex service discovery in current source.

## Current Events

- Mercury/Locus events update meeting collections and per-meeting state.
- Meeting events cover lifecycle, media, mute/share, controls, transcription/captions, and feature state.
- Members, breakouts, interpretation, AI approval, annotation, webinar, and data-channel events are meeting scoped.
- Browser/media-core callbacks report permissions, connection/track readiness, degradation, and closure.

Authoritative anchors: `src/constants.ts`, `src/common/events/`, `src/meetings/index.ts`, `src/meeting/index.ts`, and owning feature event/constants files.

## Data Stores

No durable datastore is owned. In-memory stores include meeting and meeting-info collections, Locus/member/feature projections, media/slot objects, route-token maps, timers, queues, and metric setup state. Their lifecycle is SDK/plugin/meeting scoped.

## External Dependencies

| Dependency | Purpose | Degraded/failure behavior |
|---|---|---|
| Webex device and Mercury | identity/registration and realtime events | registration stage fails or events stop; unregister remains safe |
| Locus/meeting-info services | meeting identity, state, and mutations | typed/request failure; current projection is not fabricated |
| media infrastructure/internal-media-core | WebRTC negotiation and streams | media errors, bounded recovery/rejoin, cleanup |
| reachability/STUN/TURN | route selection and network characterization | report failure/partial reachability; do not claim success |
| feature services/data channels | breakouts, AI, webinar, interpretation, annotation | capability-gated failure visible to caller/event consumer |

## Rate Limits & Quotas

No package-local numeric rate limit or quota is declared. Respect server responses and existing retry/backoff; do not invent retry budgets or add polling without approval.

## Key Metrics & Performance Targets

- Behavioral metrics are named in `src/metrics/constants.ts` and submitted through `src/metrics/index.ts`.
- Meeting/media modules also submit call-analyzer and quality/outcome telemetry through existing helpers.
- No package-specific numeric SLO or coverage threshold was supplied. Measure latency/quality regressions and preserve bounded retries, timers, and listener counts.

## Feature Flags (current)

Capability and policy fields from Webex/Locus gate meetings, breakouts, interpretation, annotation, webinar, reactions, AI approval, recording, multistream, and media behaviors. Configuration defaults live in `src/config.ts` and `src/common/config.ts`; do not duplicate mutable flag names here.

## Compliance / Certifications

The package follows repository security/privacy rules and Cisco licensing. No package-specific certification claim was found; do not infer one.

## Maintenance

Refresh this document when a service family, event source, store lifetime, rate-limit rule, metric family, or capability gate changes. Put operation detail in the owning module spec.
