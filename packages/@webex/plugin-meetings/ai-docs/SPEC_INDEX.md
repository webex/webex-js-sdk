<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: spec-index@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-21T06:10:05Z
validation_status: not-run
-->
# Spec Index — @webex/plugin-meetings

> Root [`AGENTS.md`](../AGENTS.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md). This router mirrors `.sdd/manifest.json`; load only the docs needed for the task.

## Module Registry

| Module | Responsibility | Manifest coverage state | Start here |
|---|---|---|---|
| `src/meetings/` | Registered plugin, meeting discovery, registration, and collection coordination | Partial | [`src/meetings/ai-docs/meetings-spec.md`](../src/meetings/ai-docs/meetings-spec.md) |
| `src/meeting/` | One meeting's lifecycle, media, controls, state, and events | Partial | [`src/meeting/ai-docs/meeting-spec.md`](../src/meeting/ai-docs/meeting-spec.md) |
| `src/meeting-info/` | Destination resolution and validated meeting metadata | Untracked | [`src/meeting-info/ai-docs/meeting-info-spec.md`](../src/meeting-info/ai-docs/meeting-info-spec.md) |
| `src/locus-info/` | Normalized Locus full, delta, and hash-tree state | Untracked | [`src/locus-info/ai-docs/locus-info-spec.md`](../src/locus-info/ai-docs/locus-info-spec.md) |
| `src/hashTree/` | Incremental Locus dataset synchronization | Untracked | [`src/hashTree/ai-docs/hash-tree-spec.md`](../src/hashTree/ai-docs/hash-tree-spec.md) |
| `src/member/` | Individual participant projection | Partial | [`src/member/ai-docs/member-spec.md`](../src/member/ai-docs/member-spec.md) |
| `src/members/` | Participant roster, mutations, and member events | Partial | [`src/members/ai-docs/members-spec.md`](../src/members/ai-docs/members-spec.md) |
| `src/media/` | Media connection construction and readiness | Partial | [`src/media/ai-docs/media-spec.md`](../src/media/ai-docs/media-spec.md) |
| `src/multistream/` | Remote media groups and send/receive slot management | Untracked | [`src/multistream/ai-docs/multistream-spec.md`](../src/multistream/ai-docs/multistream-spec.md) |
| `src/roap/` | ROAP signaling and TURN discovery | Untracked | [`src/roap/ai-docs/roap-spec.md`](../src/roap/ai-docs/roap-spec.md) |
| `src/reachability/` | Cluster/protocol media reachability probing | Untracked | [`src/reachability/ai-docs/reachability-spec.md`](../src/reachability/ai-docs/reachability-spec.md) |
| `src/reconnection-manager/` | Bounded media recovery and meeting rejoin | Untracked | [`src/reconnection-manager/ai-docs/reconnection-manager-spec.md`](../src/reconnection-manager/ai-docs/reconnection-manager-spec.md) |
| `src/breakouts/` | Breakout sessions, rosters, host operations, and events | Partial | [`src/breakouts/ai-docs/breakouts-spec.md`](../src/breakouts/ai-docs/breakouts-spec.md) |
| `src/interpretation/` | Simultaneous-interpretation language and handoff workflows | Partial | [`src/interpretation/ai-docs/interpretation-spec.md`](../src/interpretation/ai-docs/interpretation-spec.md) |
| `src/annotation/` | Annotation data-channel state and commands | Untracked | [`src/annotation/ai-docs/annotation-spec.md`](../src/annotation/ai-docs/annotation-spec.md) |
| `src/aiEnableRequest/` | Host approval workflow for enabling AI Assistant | Partial | [`src/aiEnableRequest/ai-docs/ai-enable-request-spec.md`](../src/aiEnableRequest/ai-docs/ai-enable-request-spec.md) |
| `src/webinar/` | Webinar practice-session and webcast controls | Untracked | [`src/webinar/ai-docs/webinar-spec.md`](../src/webinar/ai-docs/webinar-spec.md) |
| `src/recording-controller/` | Meeting recording action orchestration | Partial | [`src/recording-controller/ai-docs/recording-controller-spec.md`](../src/recording-controller/ai-docs/recording-controller-spec.md) |
| `src/controls-options-manager/` | Derivation and mutation of meeting control capabilities | Untracked | [`src/controls-options-manager/ai-docs/controls-options-manager-spec.md`](../src/controls-options-manager/ai-docs/controls-options-manager-spec.md) |
| `src/personal-meeting-room/` | Personal Meeting Room lookup and claim | Partial | [`src/personal-meeting-room/ai-docs/personal-meeting-room-spec.md`](../src/personal-meeting-room/ai-docs/personal-meeting-room-spec.md) |
| `src/reactions/` | Reaction catalogs, wire values, and normalized reaction data | Untracked | [`src/reactions/ai-docs/reactions-spec.md`](../src/reactions/ai-docs/reactions-spec.md) |
| `src/interceptors/` | Locus routing/retry and data-channel authentication middleware | Untracked | [`src/interceptors/ai-docs/interceptors-spec.md`](../src/interceptors/ai-docs/interceptors-spec.md) |
| `src/metrics/` | Behavioral metric normalization and submission | Untracked | [`src/metrics/ai-docs/metrics-spec.md`](../src/metrics/ai-docs/metrics-spec.md) |

## Task Routing

| If the task is… | Load |
|---|---|
| Understanding the package | `ARCHITECTURE.md` |
| Changing a public export, method, event, or request | `CONTRACTS.md`, owning module spec, and `RULES.md` |
| Changing tokens, identity, participant data, transcripts, or media | `SECURITY.md` and the owning module spec |
| Changing lifecycle, Locus, or roster state | `meeting`, `meetings`, `locus-info`, or `members` spec as applicable |
| Changing WebRTC setup or recovery | affected `media`, `multistream`, `roap`, `reachability`, or `reconnection-manager` spec |
| Changing an in-meeting capability | owning feature spec plus `meeting` integration points |
| Changing request middleware or telemetry | `interceptors` or `metrics` spec and security rules |
| Adding or changing an implementation convention | matching file under `patterns/` |

For any `src/{module}/` task, load its source-local spec from the registry and cross-check current code whenever its manifest state is `Partial` or `Untracked`.

## Incident History

No package-local incident or RCA index was found. Commit and PR history are intentionally excluded from current-behavior evidence for this bootstrap.

## Phase-Based Loading Protocol

| Phase | Load |
|---|---|
| Orient | `AGENTS.md` and this router |
| Specify | affected module spec, `CONTRACTS.md`, and applicable security/rule docs |
| Build | affected module spec plus relevant patterns and tests |
| Verify | focused tests, generated-doc conformance, coverage, and independent validation evidence |

## Spec Registry

| Doc | Location | Purpose |
|---|---|---|
| Architecture | `ARCHITECTURE.md` | Package and component ownership/interactions |
| Contracts | `CONTRACTS.md` | Export, event, request, and dependency catalog |
| Data model | `DATA_MODEL.md` | Client-side object and collection ownership |
| Service state | `SERVICE_STATE.md` | Current services, events, flags, and metrics |
| Security | `SECURITY.md` | Trust boundaries and sensitive-data rules |
| Rules | `RULES.md` | Enforceable package constraints |
| Patterns | `patterns/` | Code-grounded implementation conventions |
| Tests | `TEST_INDEX.md` | Source-to-test routing and quality gates |
| Getting started | `GETTING_STARTED.md` | Toolchain and focused development loop |
| Glossary | `GLOSSARY.md` | Meetings-domain language |
| Review catalog | `REVIEW_CHECKLIST.md` | Core and conditional review checks |
| Decisions | `adr/` | Durable architectural rationale |
