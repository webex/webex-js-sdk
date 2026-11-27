import {AgentChannelTypeStates, ChannelType, SELECTABLE_CHANNEL_TYPES} from './types';
import {CC_AGENT_EVENTS} from '../config/types';
import {AGENT_STATE_AVAILABLE} from '../config/constants';

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

  /** Whether the state change was initiated by the agent (true) or
   *  by a supervisor/system (false). Undefined in V1 sessions. */
  isClientInitiated?: boolean;
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
 * Channel states that are bridgeable to V1 agent-wide state.
 * States like Engaged, EngagedOther, Reserved, WrapUp, LoggedOut are V2-only.
 */
const BRIDGEABLE_STATES = new Set([AGENT_STATE_AVAILABLE, 'Idle']);

/**
 * Determines whether a channel state should be bridged to V1 events.
 */
export function shouldBridgeChannelState(agentState: string): boolean {
  return BRIDGEABLE_STATES.has(agentState);
}

/**
 * Collapses per-channel V2 states into one agent-wide V1 aggregate.
 * Any Available → Available; all Idle → Idle. Scalar fields come from
 * the first matching channel in SELECTABLE_CHANNEL_TYPES order.
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

  for (const ct of SELECTABLE_CHANNEL_TYPES) {
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
    if (state.agentState === AGENT_STATE_AVAILABLE) hasAvailable = true;
    if (state.agentState === 'Idle') hasIdle = true;
  }

  if (!hasAvailable && !hasIdle) return null;

  // Only Idle channels remain but at least one channel is in a non-bridgeable
  // state (Engaged, Reserved, WrapUp). The agent is handling a task, so the
  // aggregate is not "all Idle" and must not be bridged.
  if (!hasAvailable && hasNonBridgeable) return null;

  const subStatus: 'Available' | 'Idle' = hasAvailable ? AGENT_STATE_AVAILABLE : 'Idle';
  const primaryChannel = SELECTABLE_CHANNEL_TYPES.find(
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
    type: CC_AGENT_EVENTS.AGENT_STATE_CHANGE_SUCCESS,
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
  isClientInitiated?: boolean;
}

/**
 * Builds the `agent:stateChange` payload for a V2 session: V1 base fields from
 * the aggregate bridge plus the V2 per-channel enrichment.
 *
 * When the aggregate is not bridgeable (e.g. a channel is Engaged, Reserved or
 * WrapUp), the V1 base falls back to `subStatus: 'Idle'` with scalar fields from
 * the changed channel; V2 clients read `channelDetail`/`channelStates` instead.
 */
export function buildAgentStateChangeEvent(
  channelStates: Record<string, AgentChannelTypeStates>,
  agentId: string,
  agentSessionId: string,
  orgId: string,
  attribution: BridgeAttributionContext | undefined,
  enrichment: V2EnrichmentContext
): AgentStateChangeEvent {
  const detail = enrichment.channelDetail;
  const base: BridgedV1StateChange = bridgeStateChangeSuccess(
    channelStates,
    agentId,
    agentSessionId,
    orgId,
    attribution
  ) ?? {
    type: CC_AGENT_EVENTS.AGENT_STATE_CHANGE_SUCCESS,
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
  };

  return {...base, ...enrichment};
}
