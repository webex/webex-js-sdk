import {ChannelType, AgentChannelTypeStates} from './types';

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
 * Last V1 aggregate the bridge emitted. Idle-code changes keep the same
 * subStatus, so auxCodeId is part of the comparison.
 */
export interface LastEmittedV1State {
  subStatus: string;
  auxCodeId?: string;
}

/**
 * Determines whether to emit a V1 legacy event based on the aggregate state change.
 * Returns true when the projected subStatus or the winning channel's aux code changed.
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
 * Projects per-channel V2 states to an agent-wide V1 aggregate.
 * Returns null if no channels have bridgeable states.
 *
 * Rules:
 * - Any channel Available → Available agent-wide
 * - All channels Idle → Idle agent-wide
 * - Mixed Available + Idle → Available (any-available wins)
 * - Scalar fields come from the first channel in PRIMARY_CHANNEL_ORDER whose
 *   agentState equals that projected subStatus.
 */
export function projectAggregate(
  channelStates: Record<string, AgentChannelTypeStates>
): {subStatus: 'Available' | 'Idle'; primaryChannel: ChannelType} | null {
  let hasAvailable = false;
  let hasIdle = false;

  for (const ct of PRIMARY_CHANNEL_ORDER) {
    const state = channelStates[ct];
    if (!state || !shouldBridgeChannelState(state.agentState)) {
      // eslint-disable-next-line no-continue
      continue;
    }
    if (state.agentState === 'Available') hasAvailable = true;
    if (state.agentState === 'Idle') hasIdle = true;
  }

  if (!hasAvailable && !hasIdle) return null;

  const subStatus: 'Available' | 'Idle' = hasAvailable ? 'Available' : 'Idle';
  const primaryChannel = PRIMARY_CHANNEL_ORDER.find(
    (ct) => channelStates[ct]?.agentState === subStatus
  );

  if (!primaryChannel) return null;

  return {subStatus, primaryChannel};
}

/**
 * Optional attribution context forwarded from the V2 event into the V1 bridge.
 */
export interface BridgeAttributionContext {
  changedBy?: string | null;
  changedById?: string | null;
  changedByName?: string | null;
}

/**
 * Bridges a V2 AgentChannelStateChanged notification to a V1 StateChangeSuccess shape.
 * Returns null if the state is not bridgeable.
 *
 * When `attribution` is provided (from the V2 channel event), those fields are
 * forwarded into the V1 payload so consumers retain who initiated the change.
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
