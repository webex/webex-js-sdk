# Feature Spec — Granular Agent State Sample UI

> **Navigation:** [AGENTS.md](../../../AGENTS.md) → [SPEC_INDEX.md](../../../SPEC_INDEX.md) → [ARCHITECTURE.md](../../../ARCHITECTURE.md)

## Metadata
| Field | Value |
|---|---|
| Feature / ticket key | WXCC-15791 |
| Title | Granular Agent State — Widget-like UI in SDK Sample App |
| Status | implementation-ready |
| Change class | ui |
| Generated from | `feature-spec` @ SDLC template library `0.2.0` |

## Problem & Goal (WHAT + WHY)
**What:** Add a widget-like Granular Agent State UI to the Contact Center SDK sample app that mirrors the `@webex/cc-widgets` GranularAgentState React component, implemented in vanilla HTML/CSS/JS (no build step).

**Why:** The sample app is the primary developer reference for SDK integrations. V2 (granular) agent state sessions require per-channel state management. Without a visual reference, SDK consumers must reverse-engineer the widget source to understand the expected UX patterns.

## Scope
**In scope:**
- Detect V2 session at login (`getAgentStateControl().active === true`) and switch UI
- V1 session: show simple idle code dropdown only (no timer, no button changes needed)
- V2 session: render widget-like pill → hover preview → state menu → manage channel availability
- Sequential channel state changes (Available first, then Idle)
- Changed-channel filtering (skip no-op requests)
- Event-driven UI updates via `agent:channelStateChange`, `agent:channelStateChangeFailed`, `agent:channelReloginSuccess`, `agent:channelRecoveryDeferred`

**Out of scope:**
- Production React/web-component widget changes
- Momentum Design System icons (using Font Awesome 4.7 already in sample app)
- Unit/integration test files (sample app has no test harness)
- Changes to existing V1 agent state logic

## Requirements
| Req ID | Requirement | Rationale | Acceptance | State |
|---|---|---|---|---|
| R-1 | Session-version detection at login | V1/V2 behavior is pinned per session | `getAgentStateControl().active` checked after `stationLogin()` resolves | Implemented |
| R-2 | V1 UI: idle code dropdown only | V1 sessions have no per-channel control | Dropdown visible, pill hidden when V1 | Implemented |
| R-3 | V2 pill button with channel avatars, presence dots, timer | Matches widget visual design | Pill renders with primary channel state, all channel avatars, live timer | Implemented |
| R-4 | Hover preview showing per-channel state and duration | Matches widget hover tooltip | Tooltip appears on pill hover, hides on leave or menu open | Implemented |
| R-5 | State menu with search, "Set as Available", idle code list, "Manage Channel Availability" | Matches widget state menu | Menu opens on pill click, search filters idle codes, actions trigger SDK calls | Implemented |
| R-6 | Manage Channel Availability panel with per-channel toggles | Matches widget manage panel | All toggle, per-channel toggles, Cancel/Apply with changed-only detection | Implemented |
| R-7 | Sequential apply: Available channels first, then Idle | Prevents race conditions (widget W-R-6) | `async/await` in `applyChannelAvailability`, not `Promise.all` | Implemented |
| R-8 | Changed-channel filtering | Avoids unnecessary SDK calls | `getGranularChannelsToChange()` skips channels already in target state | Implemented |

## Acceptance Criteria
- V1 session login shows only the idle code dropdown, timer, and set button (R-1, R-2)
- V2 session login shows the pill with channel avatars and presence dots (R-1, R-3)
- Hovering the pill shows a preview with per-channel state and elapsed time (R-4)
- Clicking the pill opens the state menu with search, available action, and idle codes (R-5)
- "Manage Channel Availability" shows per-channel toggles; Apply is disabled until a change is made (R-6)
- Apply sends Available channels first, then Idle sequentially (R-7)
- Channels already in the target state are not included in SDK calls (R-8)
- Logout/deregister tears down the widget and restores V1 UI
- No existing sample app functionality is broken

## Primary Code Touchpoints
| File | Change |
|---|---|
| `docs/samples/contact-center/index.html` | Restructured Agent status fieldset with `v1-agent-state` / `v2-agent-state` containers |
| `docs/samples/contact-center/app.js` | Added ~600 lines: constants, state, 29 functions for widget rendering and SDK interaction |
| `docs/samples/contact-center/style.css` | Added ~450 lines: pill, avatars, presence dots, preview, menu, manage panel, toggle switches |

## UI Flow
1. **Login** → `handleGranularStateLogin()` detects V2 → `switchAgentStateUI(true)` hides V1, shows V2
2. **Pill rendered** → primary channel state label + timer + all channel avatars with presence dots
3. **Hover** → preview tooltip with per-channel rows (label, display state, elapsed time)
4. **Click pill** → state menu: search input, "Set as Available" button, "Manage Channel Availability" link, idle code list
5. **Select idle code** → `setAllChannelsIdle()` with changed-channel filtering → SDK call → UI update
6. **Manage panel** → back button, "All" toggle, per-channel toggles, Cancel/Apply
7. **Apply** → `applyChannelAvailability()` sequential: Available first, then Idle → SDK calls → UI update
8. **Logout** → `handleGranularStateLogout()` tears down widget, restores V1 UI

## Prior-Work Register
| Existing artifact | How it relates | Reuse / extend / supersede |
|---|---|---|
| `@webex/cc-widgets` GranularAgentState component | React widget this sample mirrors | Reference for UI parity |
| `WellnessSampleUtils.getSelectableIdleCodes()` | Filters system/RONA idle codes | Reuse (already imported) |
| Existing V1 `handleAgentStatus` / `setAgentStatus` | V1 agent state flow | Preserved (shown in V1 mode) |

## Spec State
| Section | State |
|---|---|
| Problem & Goal | complete |
| Scope | complete |
| Requirements | complete |
| Acceptance Criteria | complete |
| Primary Code Touchpoints | complete |
| UI Flow | complete |
| Stakeholders & Open Questions | N/A — sample app only |
| Success & Guardrail Metrics | N/A — sample app only |
| Contracts Delta | N/A — no API changes |
| Impacted Modules | N/A — sample app only |
| Feasibility & Risks | N/A — straightforward UI |
| Security / Compliance | N/A — no auth/data changes |
| Migration | N/A — no breaking changes |

## References
- Widget source: `webex-widgets/packages/contact-center/cc-components/src/components/GranularAgentState/`
- Widget feature spec: `webex-widgets/ai-docs/features/WXCC-15791-user-granular-agent-state/spec/feature-spec.md`
- SDK APIs: `webex.cc.setAgentState()`, `webex.cc.getChannelStates()`, `webex.cc.getAgentStateControl()`
