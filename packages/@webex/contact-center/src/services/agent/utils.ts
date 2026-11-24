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

/**
 * Last V1 aggregate the bridge emitted. Idle-code changes keep the same
 * subStatus, so auxCodeId is part of the comparison.
 */
export interface LastEmittedV1State {
  subStatus: string;
  auxCodeId?: string;
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
 * Returns true when the V2→V1 bridge should emit `agent:stateChange`.
 * Suppresses duplicate emissions when the projected aggregate and auxCodeId
 * haven't changed since the last emission.
 */
export function shouldEmitLegacyEvent(
  channelStates: Record<string, AgentChannelTypeStates>,
  lastEmitted?: LastEmittedV1State
): boolean {
  const projected = projectAggregate(channelStates);
  if (!projected) return false;
  if (!lastEmitted) return true;
  if (projected.subStatus !== lastEmitted.subStatus) return true;
  const auxCodeId = channelStates[projected.primaryChannel]?.auxCodeId ?? '';

  return auxCodeId !== (lastEmitted.auxCodeId ?? '');
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
