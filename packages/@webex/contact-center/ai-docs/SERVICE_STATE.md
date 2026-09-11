# Service State (living) — @webex/contact-center

> Start here → root [`AGENTS.md`](../AGENTS.md) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md). Read before adding a surface.

## Current Events

| Event / topic | Direction | Producer/consumer | Payload ref |
|---|---|---|---|
| `agent:*` | publish | ContactCenter → application | `src/services/agent/types.ts` |
| `task:*` | publish | Task/TaskManager → application | `src/services/task/types.ts` |
| `CC_EVENTS` | consume | WCC WebSocket → Core/ContactCenter/Task/AqmReqs | `src/services/config/types.ts` |
| realtime transcript/suggestion | consume/publish | RTD WebSocket → owning Task | `src/services/task/TaskManager.ts` |
| `Wellness_Break_Handler` | consume/publish | Primary data-notification or RTD WebSocket → ContactCenter → `CC_AGENT_EVENTS.WELLNESS_BREAK` | `src/cc.ts`, `src/types.ts` |
| `AIAssistantRTDStatusChanged` | publish | ContactCenter → application | `src/types.ts`, `src/services/config/types.ts` |
| State Control V2 agent-channel events (internal) | consume/normalize | WCC WebSocket → ContactCenter/AqmReqs first-party compatibility | `src/services/agent/types.ts`, `src/services/config/types.ts` |

## Data Stores

| Store | Purpose | Owned by this service? |
|---|---|---|
| In-memory PageCache Map | temporary paginated lookup reuse | ephemeral only; yes for cache entries |
| Remote WCC stores | agent/task/config domain state | no |

## External Dependencies

| Dependency | Used for | Timeout / retry | Circuit breaker / fallback |
|---|---|---|---|
| WCC API gateway | agent/task/config/data operations | operation/AQM timeouts | propagate structured failure |
| WCC WebSocket/RTD | realtime events and completion | reconnect and recovery timers | reconnect/silent relogin/restore failure |
| Webex Calling | BROWSER call lifecycle | async registration/call timeouts | emit/rethrow calling failure |
| Webex metrics | telemetry | nonblocking queued submission | log/drop without breaking product flow |

## Key Metrics & Performance Targets

| Signal | Target | Where measured |
|---|---|---|
| Unit coverage | 85% branches/functions/lines/statements | package Jest configuration |
| Operation duration/success/failure | no local numeric SLO routed | MetricsManager event taxonomy |
| Connection recovery | explicit 8s disconnect, 5s retry, configured restore timeout | Core constants/ConnectionService |

## Feature Flags (current)

| Flag/config | Gates | Current default | Owner | Safe to remove when |
|---|---|---|---|---|
| `allowAutomatedRelogin` | silent relogin after recovery | config-defined | ContactCenter | replacement recovery contract exists |
| `webRtcEnabled` / login option | browser calling path | remote profile | Config/WCC | remote contract removed |
| task UI/config flags | task controls and operations | profile/config-defined | Task/Config | owning behavior removed |
| `Profile.isWellnessBreakEnabled` | wellness RTD connection, event/action APIs, system-code access | false unless backend AI enablement, reminders, and positive license quantity are all present | Config/ContactCenter | wellness contract removed |

The backend-delivered `agentWellbeing.enable` value is the supported server rollout decision. The SDK combines it with `wellnessBreakReminders === 'ENABLED'` and `aiAssistantQuantity > 0`; it does not evaluate the Desktop Split flag or define a new rollout response field.

## Maintenance

- Update the relevant row in the same change as any surface, dependency, timeout, metric, or flag.
