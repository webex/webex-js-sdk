# Glossary — @webex/calling

> Root [`AGENTS.md`](../AGENTS.md) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · contracts [`CONTRACTS.md`](CONTRACTS.md).

## Domain Terms

| Term | Definition | Authoritative location | Notes |
|---|---|---|---|
| CallingClient | Top-level calling orchestration client that creates lines and coordinates registration/call lifecycle | `src/CallingClient/` | Not the same as an individual Call |
| Line | A telephony line exposed to consumers for registration and call operations | `src/CallingClient/line/` | Owns a Registration instance |
| Call | One inbound/outbound call lifecycle and its signaling/media state | `src/CallingClient/calling/` | Managed by CallManager |
| Registration | Mobius device registration, keepalive, failover/failback, and cleanup lifecycle | `src/CallingClient/registration/` | Internal to Line |
| Mobius | Webex Calling signaling/backend service reached over HTTP or WebSocket | `src/mobius-socket/`; `src/CallingClient/` | Not Mercury |
| Mercury | Webex real-time event channel used for session/recording events | `src/SDKConnector/`; `src/Events/types.ts` | Host Webex SDK owns connection |
| Janus | Webex call-history service | `src/CallHistory/` | Remote service, not local storage |
| ROAP | WebRTC offer/answer protocol used by the media engine | `src/CallingClient/calling/` | Media signaling state machine |
| Calling backend | Resolved WXC, UCM, or BroadWorks behavior/provider | `src/common/types.ts`; `src/common/Utils.ts` | Capability matrices differ |
| SDKConnector | Singleton adapter around the host Webex SDK | `src/SDKConnector/` | Can be initialized once |

## Abbreviations & Acronyms

| Abbreviation | Expansion | Meaning here |
|---|---|---|
| WXC | Webex Calling | Cloud calling backend |
| UCM | Unified Communications Manager | Enterprise calling backend |
| WDM | Webex Device Management | Device/config/service discovery |
| SCIM | System for Cross-domain Identity Management | People/contact resolution protocol |
| KMS | Key Management Service | Contact-field encryption/decryption |
| DND | Do Not Disturb | User call setting |
| CFA | Call Forward Always | User call-forwarding setting |

## Context-Specific Meanings

| Term | Context | Meaning |
|---|---|---|
| Event | `Events/types.ts` | Typed SDK event contract |
| Event | Mercury/Mobius transport | Remote real-time message consumed and translated by a module |
| Client | CallingClient | Core line/call orchestration client |
| Client | Feature modules | Factory-created History/Settings/Contacts/Voicemail/Recording facade |

## Deprecated / Renamed Terms

No authoritative repository-local rename registry was found. Preserve existing exported names; record future renames and compatibility windows here.

## Maintenance

- Add new domain concepts, event families, states, and renamed terms in the same change that introduces them.
