# Glossary — @webex/calling

## Domain Terms

| Term | Meaning |
|---|---|
| CallingClient | top-level coordinated calling client |
| Line | user/device calling line that owns registration and calls |
| Registration | Mobius reachability lifecycle including keepalive/failover |
| Call | one call-control and media lifecycle |
| CallManager | internal owner of active Call objects and Mobius routing |
| Backend connector | WXC/UCM/Broadworks-specific implementation behind a facade |
| Mercury | Webex event transport consumed through the SDK |
| Mobius | Webex calling signaling service accessed over HTTP/WebSocket |
| ROAP | media offer/answer signaling exchanged during call setup/update |

## Abbreviations & Acronyms

| Term | Meaning |
|---|---|
| WXC | Webex Calling |
| UCM | Unified Communications Manager |
| BWRKS/BWKS | Broadworks backend |
| DND | Do Not Disturb |
| CFA | Call Forward Always |
| SCIM | System for Cross-domain Identity Management |
| WSS | secure WebSocket |
| VQ | voice-quality telemetry |

## Context-Specific Meanings

- “Public” means exported through `src/index.ts`, not merely exported from an internal source file.
- “Persistence” excludes transient in-memory state and the approved registration/configuration localStorage entries.
- “Backend” means the user's calling platform, not the JavaScript execution runtime.

## Deprecated / Renamed Terms

Retain source enum/string values required for compatibility. When terminology changes, record the old and new names here and in the affected contract/spec before removal.

## Maintenance

Update terms with source contracts and avoid introducing aliases that do not exist in code or backend documentation.
