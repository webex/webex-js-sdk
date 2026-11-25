import {AgentChannelTypeStates, ChannelType} from './types';

// ─── V1 Bridge Types ─────────────────────────────────────────────────────────

/**
 * Flat V1 aggregate state-change payload emitted for legacy `agent:stateChange`
 * listeners when bridging from V2 per-channel state.
 */
export interface BridgedV1StateChange {
  type: 'AgentStateChangeSuccess';
  agentId: string;
  agentSessionId: string;
  orgId: string;
  status: string;
  subStatus: 'Available' | 'Idle';
  auxCodeId: string;
  lastStateChangeTimestamp: number;
  lastIdleCodeChangeTimestamp: number;
  lastStateChangeReason: string;
  changedBy: string | null;
  changedById: string | null;
  changedByName: string | null;
}

// ─── Enriched Event Types (Unified SDK Event Surface) ─────────────────────────

/**
 * Enriched state-change payload emitted on `agent:stateChange`.
 * Extends the V1 base with optional V2 per-channel fields.
 * In V1 sessions the V2 fields are undefined; in V2 sessions they carry
 * the full per-channel detail so clients render from one event.
 */
export interface AgentStateChangeEvent extends BridgedV1StateChange {
  /** Which channel triggered this specific event. */
  changedChannelType?: ChannelType;

  /** All channels that changed in this batch.
   *  Single-channel: ['chat']. Bulk: ['telephony','chat','email','social']. */
  changedChannels?: ChannelType[];

  /** Per-channel state detail for the changed channel.
   *  Shortcut for channelStates[changedChannelType]. */
  channelDetail?: AgentChannelTypeStates;

  /** Full snapshot of ALL channel states at the time of the event. */
  channelStates?: Record<ChannelType, AgentChannelTypeStates>;

  /** Backend request correlation ID — shared across all channel
   *  notifications from the same setAgentState() call. */
  requestTrackingId?: string;
}

/**
 * Enriched failure payload emitted on `agent:stateChangeFailed`.
 * V1 sessions emit the base fields; V2 sessions add channelType.
 */
export interface AgentStateChangeFailedEvent {
  type: string;
  reason?: string;
  reasonCode?: number;
  isClientInitiated?: boolean;
  eventTime?: number;
  /** V2 enrichment: which channel failed. Undefined in V1 sessions. */
  channelType?: ChannelType;
}

/**
 * Relogin payload emitted on `agent:reloginSuccess`.
 * Both V1 and V2 sessions carry the full V1-normalized metadata
 * (deviceType, dn, teamId, siteId, roles, mmProfile, etc.).
 * V2 sessions additionally include the per-channel state snapshot.
 */
export interface AgentReloginSuccessEvent {
  type: string;
  agentId: string;
  agentSessionId: string;
  orgId: string;
  status: string;
  subStatus: string;
  auxCodeId: string;
  lastStateChangeTimestamp: number;
  lastIdleCodeChangeTimestamp: number;
  /** Device type used for this session (e.g. 'BROWSER', 'AGENT_DN', 'EXTENSION'). */
  deviceType?: string;
  /** Directory number for the agent's station. */
  dn?: string;
  /** Team the agent belongs to. */
  teamId?: string;
  /** Site where the agent is located. */
  siteId?: string;
  /** Roles assigned to the agent. */
  roles?: string[];
  /** Device identifier. */
  deviceId?: string | null;
  /** Whether login is via extension. */
  isExtension?: boolean;
  /** Channel capacity counts (from channelsMap lengths). */
  mmProfile?: Record<string, number | undefined>;
  /** Outer WebSocket notification trackingId. */
  notifsTrackingId?: string;
  /** Full snapshot of ALL channel states after relogin (V2 sessions only). */
  channelStates?: Record<ChannelType, AgentChannelTypeStates>;
}

/**
 * Enriched reconnect payload emitted on `agent:connectionReconnected`.
 * V2 sessions with deferred BROWSER telephony recovery add deferral fields.
 */
export interface AgentReconnectedEvent {
  /** Channels whose recovery was deferred (e.g. ['telephony']). */
  deferredChannels?: ChannelType[];
  /** 'deferred' when telephony recovery is pending. */
  recoveryStatus?: 'deferred' | 'recovered';
  /** Timeout in ms before automatic recovery attempt. */
  deferralTimeoutMs?: number;
}

/**
 * Optional attribution context forwarded from the V2 event into the V1 bridge.
 */
export interface BridgeAttributionContext {
  changedBy?: string | null;
  changedById?: string | null;
  changedByName?: string | null;
}

// ─── V1 Bridge Functions ─────────────────────────────────────────────────────

/**
 * Primary channel order for scalar field resolution in V1 bridging.
 * When projecting per-channel states to agent-wide V1 state,
 * scalar fields are taken from the first available channel in this order.
 *
 * `workItem` and `customMessaging` are intentionally excluded: they are
 * internal channel types that do not participate in the customer-facing
 * V1 agent-wide state projection or in the user-selectable channel set.
 */
const PRIMARY_CHANNEL_ORDER: ChannelType[] = ['telephony', 'chat', 'email', 'social'];

/**
 * Channel states that are bridgeable to V1 agent-wide state.
 * States like Engaged, EngagedOther, Reserved, WrapUp, LoggedOut are V2-only.
 */
const BRIDGEABLE_STATES = new Set(['Available', 'Idle']);

/**
 * Determines whether a channel state should be bridged to V1 events.
 */
export function shouldBridgeChannelState(agentState: string): boolean {
  return BRIDGEABLE_STATES.has(agentState);
}

/**
 * Collapses per-channel V2 states into one agent-wide V1 aggregate.
 * Any Available → Available; all Idle → Idle. Scalar fields come from
 * the first matching channel in PRIMARY_CHANNEL_ORDER.
 * Returns null when no channels have bridgeable states, or when only Idle
 * channels remain while other channels are in non-bridgeable states
 * (Engaged, Reserved, WrapUp) — a task transition must not make V1
 * listeners see an Idle transition.
 */
export function projectAggregate(
  channelStates: Record<string, AgentChannelTypeStates>
): {subStatus: 'Available' | 'Idle'; primaryChannel: ChannelType} | null {
  let hasAvailable = false;
  let hasIdle = false;
  let hasNonBridgeable = false;

  for (const ct of PRIMARY_CHANNEL_ORDER) {
    const state = channelStates[ct];
    if (!state) {
      // eslint-disable-next-line no-continue
      continue;
    }
    if (!shouldBridgeChannelState(state.agentState)) {
      hasNonBridgeable = true;
      // eslint-disable-next-line no-continue
      continue;
    }
    if (state.agentState === 'Available') hasAvailable = true;
    if (state.agentState === 'Idle') hasIdle = true;
  }

  if (!hasAvailable && !hasIdle) return null;

  // Only Idle channels remain but at least one channel is in a non-bridgeable
  // state (Engaged, Reserved, WrapUp). The agent is handling a task, so the
  // aggregate is not "all Idle" and must not be bridged.
  if (!hasAvailable && hasNonBridgeable) return null;

  const subStatus: 'Available' | 'Idle' = hasAvailable ? 'Available' : 'Idle';
  const primaryChannel = PRIMARY_CHANNEL_ORDER.find(
    (ct) => channelStates[ct]?.agentState === subStatus
  );

  if (!primaryChannel) return null;

  return {subStatus, primaryChannel};
}

/**
 * Builds a V1 StateChangeSuccess payload from V2 per-channel states.
 * Returns null when the aggregate is not bridgeable.
 * Forwards `attribution` (changedBy/changedById/changedByName) when provided.
 */
export function bridgeStateChangeSuccess(
  channelStates: Record<string, AgentChannelTypeStates>,
  agentId: string,
  agentSessionId: string,
  orgId: string,
  attribution?: BridgeAttributionContext
): BridgedV1StateChange | null {
  const aggregate = projectAggregate(channelStates);
  if (!aggregate) return null;

  const primaryState = channelStates[aggregate.primaryChannel];

  return {
    type: 'AgentStateChangeSuccess',
    agentId,
    agentSessionId,
    orgId,
    status: 'LoggedIn',
    subStatus: aggregate.subStatus,
    auxCodeId: primaryState.auxCodeId ?? '',
    lastStateChangeTimestamp: primaryState.stateChangeTimestamp,
    lastIdleCodeChangeTimestamp: primaryState.lastIdleCodeChangeTimestamp ?? 0,
    lastStateChangeReason: primaryState.stateChangeReason,
    changedBy: attribution?.changedBy ?? null,
    changedById: attribution?.changedById ?? null,
    changedByName: attribution?.changedByName ?? null,
  };
}

/**
 * V2 enrichment context attached to the unified event payload.
 */
export interface V2EnrichmentContext {
  channelStates: Record<ChannelType, AgentChannelTypeStates>;
  changedChannelType: ChannelType;
  channelDetail: AgentChannelTypeStates;
  requestTrackingId?: string;
  changedChannels: ChannelType[];
}

/**
 * Builds an enriched V1+V2 state-change payload for the unified `agent:stateChange` event.
 * Computes V1 base fields via bridgeStateChangeSuccess, then attaches V2 enrichment.
 *
 * When the aggregate is bridgeable (Available/Idle), the V1 base fields come from the
 * projected aggregate. When the aggregate is NOT bridgeable (e.g. a channel is Engaged,
 * Reserved, or WrapUp during task handling), the V1 base fields are omitted and the
 * enrichment still carries the full per-channel detail so V2 clients can update.
 *
 * Always returns a payload — never drops V2 channel state changes.
 */
export function buildAgentStateChangeEvent(
  channelStates: Record<string, AgentChannelTypeStates>,
  agentId: string,
  agentSessionId: string,
  orgId: string,
  attribution: BridgeAttributionContext | undefined,
  enrichment: V2EnrichmentContext
): AgentStateChangeEvent {
  const base = bridgeStateChangeSuccess(channelStates, agentId, agentSessionId, orgId, attribution);

  if (base) {
    return {
      ...base,
      changedChannelType: enrichment.changedChannelType,
      changedChannels: enrichment.changedChannels,
      channelDetail: enrichment.channelDetail,
      channelStates: enrichment.channelStates,
      requestTrackingId: enrichment.requestTrackingId,
    };
  }

  // Non-bridgeable aggregate (Engaged, Reserved, WrapUp) — the V1 projection
  // cannot produce a valid Available/Idle, but V2 clients still need the
  // per-channel update. Emit with V1 base fields set to 'Idle' (safe default
  // for V1 clients that check subStatus) + full V2 enrichment. V2-aware clients
  // should read channelDetail.agentState for the actual per-channel state.
  const detail = enrichment.channelDetail;

  return {
    type: 'AgentStateChangeSuccess',
    agentId,
    agentSessionId,
    orgId,
    status: 'LoggedIn',
    subStatus: 'Idle',
    auxCodeId: detail?.auxCodeId ?? '',
    lastStateChangeTimestamp: detail?.stateChangeTimestamp ?? 0,
    lastIdleCodeChangeTimestamp: detail?.lastIdleCodeChangeTimestamp ?? 0,
    lastStateChangeReason: detail?.stateChangeReason ?? '',
    changedBy: attribution?.changedBy ?? null,
    changedById: attribution?.changedById ?? null,
    changedByName: attribution?.changedByName ?? null,
    changedChannelType: enrichment.changedChannelType,
    changedChannels: enrichment.changedChannels,
    channelDetail: enrichment.channelDetail,
    channelStates: enrichment.channelStates,
    requestTrackingId: enrichment.requestTrackingId,
  };
}
