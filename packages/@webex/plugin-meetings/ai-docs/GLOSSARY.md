<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: glossary@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-18T15:33:39Z
validation_status: not-run
-->
# GLOSSARY — @webex/plugin-meetings

## Domain Terms

| Term | Meaning here | Code anchor |
|---|---|---|
| Meeting | Client object coordinating one Webex meeting lifecycle and media session | `src/meeting/index.ts` |
| Meetings | Registered plugin and collection-level coordinator | `src/meetings/index.ts` |
| Locus | Webex meeting-state service/payload projected into the client | `src/locus-info/index.ts` |
| Member | Normalized participant projection | `src/member/index.ts` |
| ROAP | Offer/answer signaling protocol used during media negotiation | `src/roap/index.ts` |
| multistream | Receive/send slot and remote-media management over a media connection | `src/multistream/` |
| breakout | Main/session-group state and controls for breakout sessions | `src/breakouts/` |
| simultaneous interpretation | Language-channel and interpreter handoff feature | `src/interpretation/` |
| practice session | Webinar state/data-channel flow before public webcast | `src/webinar/index.ts` |
| PMR | Personal Meeting Room resolved/claimed for a user | `src/personal-meeting-room/` |

## Abbreviations & Acronyms

| Abbreviation | Expansion / local meaning |
|---|---|
| SDK | Software Development Kit; the Webex host that mounts this plugin |
| PMR | Personal Meeting Room |
| ROAP | RTCWeb Offer/Answer Protocol |
| SDP | Session Description Protocol |
| STUN/TURN | WebRTC reachability/relay protocols |
| CSI | Contributing Source Identifier used to associate media and participants |
| BRB | Be right back meeting state |
| LLM | Large-language-model feature/event context in current integrations |

## Context-Specific Meanings

- **register/unregister** can mean SDK device/Mercury registration, not npm package registration.
- **join** means joining meeting state; **add media** is a distinct staged operation and may follow join.
- **leave** exits the local participant; **end for all** is a privileged remote mutation.
- **collection** usually means an in-memory Ampersand/package collection, not persistence.
- **full state**, **delta**, and **hash tree** are alternate Locus synchronization forms for one projection.

## Deprecated / Renamed Terms

- Consumer docs map older phone-plugin flows to meetings plugin methods in retained `UPGRADING.md`.
- Participant email was removed from participant convenience data; use participant identity with the People API.
- Some legacy docs describe breakout host operations as unimplemented; current `src/breakouts/index.ts` implements create/start/end/update/assignment and lock operations, so the old statement is stale.

## Maintenance

Add a term when it has a package-specific meaning that could cause an incorrect implementation. Anchor definitions to source paths and record renames/deprecations in `CONTRACTS.md` as well.
