import {Msg} from '../core/GlobalTypes';

/**
 * Response type received when an agent successfully logs out from the system
 * @public
 * @remarks
 * This type represents the response message sent by the server when an agent
 * successfully logs out. It includes essential details about the logout action
 * and the agent's final state.
 */
export type LogoutSuccess = Msg<{
  /** Message type identifier for agent desktop events */
  eventType: 'AgentDesktopMessage';
  /** Unique identifier of the agent */
  agentId: string;
  /** Tracking ID for the logout request */
  trackingId: string;
  /** Current session ID of the agent */
  agentSessionId: string;
  /** Organization ID the agent belongs to */
  orgId: string;
  /** Current status of the agent (e.g., 'LoggedOut') */
  status: string;
  /** Detailed status information */
  subStatus: string;
  /** Identity of who initiated the logout if not the agent themselves */
  loggedOutBy?: string;
  /** List of roles assigned to the agent */
  roles?: string[];
  /** Type identifier for logout success event */
  type: 'AgentLogoutSuccess';
}>;

/**
 * Response type received when an agent successfully relogins to the system
 * @public
 * @remarks
 * Represents the response message when an agent successfully re-authenticates.
 * Contains comprehensive information about the agent's new session, including
 * their state, assigned channels, and device information.
 */
export type ReloginSuccess = Msg<{
  /** Message type identifier for agent desktop events */
  eventType: 'AgentDesktopMessage';
  /** Unique identifier of the agent */
  agentId: string;
  /** Tracking ID for the relogin request */
  trackingId: string;
  /** Auxiliary code ID for the agent's initial state */
  auxCodeId: string;
  /** ID of the team the agent belongs to */
  teamId: string;
  /** New session ID assigned to the agent */
  agentSessionId: string;
  /** Directory number assigned to the agent */
  dn: string;
  /** Organization ID the agent belongs to */
  orgId: string;
  /** List of active interaction IDs */
  interactionIds: string[];
  /** Indicates if login is via extension */
  isExtension: boolean;
  /** Current login status */
  status: 'LoggedIn';
  /** Current sub-status */
  subStatus: 'Idle';
  /** ID of the site where the agent is located */
  siteId: string;
  /** Timestamp of last idle code change */
  lastIdleCodeChangeTimestamp: number;
  /** Timestamp of last state change */
  lastStateChangeTimestamp: number;
  /** Reason for the last state change */
  lastStateChangeReason?: string;
  /** Type of agent profile */
  profileType: string;
  /** Map of channel types to channel IDs */
  channelsMap: Record<string, string[]>;
  /** Phone number for dialing */
  dialNumber?: string;
  /** List of roles assigned to the agent */
  roles?: string[];
  /** Type of device being used */
  deviceType?: DeviceType;
  /** Unique identifier of the device */
  deviceId?: string | null;
  /** Flag indicating if emergency modal was shown */
  isEmergencyModalAlreadyDisplayed?: boolean;
  /** Type identifier for relogin success event */
  type: 'AgentReloginSuccess';
}>;

/**
 * Response type received when an agent's state is successfully changed
 * @public
 * @remarks
 * Contains information about the agent's new state, including who initiated
 * the change and timestamps for tracking state transitions.
 */
export type StateChangeSuccess = Msg<{
  /** Message type identifier for agent desktop events */
  eventType: 'AgentDesktopMessage';
  /** Unique identifier of the agent */
  agentId: string;
  /** Tracking ID for the state change request */
  trackingId: string;
  /** Auxiliary code ID associated with the new state */
  auxCodeId: string;
  /** Current session ID of the agent */
  agentSessionId: string;
  /** Organization ID the agent belongs to */
  orgId: string;
  /** Current status of the agent */
  status: string;
  /** Detailed status indicating availability */
  subStatus: 'Available' | 'Idle';
  /** Timestamp of last idle code change */
  lastIdleCodeChangeTimestamp: number;
  /** Timestamp of current state change */
  lastStateChangeTimestamp: number;
  /** Type identifier for state change success event */
  type: 'AgentStateChangeSuccess';
  /** Identity of who initiated the state change */
  changedBy: string | null;
  /** ID of the user who initiated the change */
  changedById: string | null;
  /** Name of the user who initiated the change */
  changedByName: string | null;
  /** Reason for the state change */
  lastStateChangeReason: string;
}>;

/**
 * Response type received when an agent successfully logs into their station
 * @public
 * @remarks
 * Represents the success response when an agent logs into their workstation.
 * Includes details about the agent's initial state, assigned teams, and channels.
 */
export type StationLoginSuccess = Msg<{
  /** Message type identifier for agent desktop events */
  eventType: 'AgentDesktopMessage';
  /** Unique identifier of the agent */
  agentId: string;
  /** Tracking ID for the station login request */
  trackingId: string;
  /** Auxiliary code ID for initial state */
  auxCodeId: string;
  /** ID of the team the agent belongs to */
  teamId: string;
  /** New session ID assigned to the agent */
  agentSessionId: string;
  /** Organization ID the agent belongs to */
  orgId: string;
  /** List of active interaction IDs */
  interactionIds: string[];
  /** Current login status */
  status: string;
  /** Current availability status */
  subStatus: 'Available' | 'Idle';
  /** ID of the site where the agent is located */
  siteId: string;
  /** Timestamp of last idle code change */
  lastIdleCodeChangeTimestamp: number;
  /** Timestamp of last state change */
  lastStateChangeTimestamp: number;
  /** Type of agent profile */
  profileType: string;
  /** Map of channel types to channel IDs */
  channelsMap: Record<string, string[]>;
  /** Phone number for dialing */
  dialNumber?: string;
  /** List of roles assigned to the agent */
  roles?: string[];
  /** Session ID of the supervising agent if applicable */
  supervisorSessionId?: string;
  /** Type identifier for station login success event */
  type: 'AgentStationLoginSuccess';
}>;

/**
 * Extended response type for station login success that includes notification tracking
 * @public
 * @remarks
 * Similar to StationLoginSuccess but includes additional fields for notification
 * tracking and multimedia profile settings.
 */
export type StationLoginSuccessResponse = {
  /** Message type identifier for agent desktop events */
  eventType: 'AgentDesktopMessage';
  /** Unique identifier of the agent */
  agentId: string;
  /** Tracking ID for the station login request */
  trackingId: string;
  /** Auxiliary code ID for initial state */
  auxCodeId: string;
  /** ID of the team the agent belongs to */
  teamId: string;
  /** New session ID assigned to the agent */
  agentSessionId: string;
  /** Organization ID the agent belongs to */
  orgId: string;
  /** List of active interaction IDs */
  interactionIds: string[];
  /** Current login status */
  status: string;
  /** Current availability status */
  subStatus: 'Available' | 'Idle';
  /** ID of the site where the agent is located */
  siteId: string;
  /** Timestamp of last idle code change */
  lastIdleCodeChangeTimestamp: number;
  /** Timestamp of last state change */
  lastStateChangeTimestamp: number;
  /** Type of agent profile */
  profileType: string;
  /** Multimedia profile capacity settings */
  mmProfile: {
    /** Maximum concurrent chat capacity */
    chat: number;
    /** Maximum concurrent email capacity */
    email: number;
    /** Maximum concurrent social media capacity */
    social: number;
    /** Maximum concurrent voice call capacity */
    telephony: number;
  };
  /** Phone number for dialing */
  dialNumber?: string;
  /** List of roles assigned to the agent */
  roles?: string[];
  /** Session ID of the supervising agent if applicable */
  supervisorSessionId?: string;
  /** Type identifier for station login success event */
  type: 'AgentStationLoginSuccess';
  /** Tracking ID for notifications */
  notifsTrackingId: string;
};

/**
 * Extended response type for agent device type update success
 * @public
 * @remarks
 * Represents the response when an agent's device type is successfully updated.
 * Contains all the details of the agent's session and device configuration.
 */
export type DeviceTypeUpdateSuccess = Omit<StationLoginSuccessResponse, 'type'> & {
  type: 'AgentDeviceTypeUpdateSuccess';
};
/**
 * Parameters required for initiating an agent logout
 * @public
 * @remarks
 * Defines the parameters that can be provided when logging out an agent,
 * including the reason for logout which helps with reporting and auditing.
 */
export type Logout = {
  /** Reason for the logout action */
  logoutReason?:
    | 'User requested logout'
    | 'Inactivity Logout'
    | 'User requested agent profile update';
};

/**
 * Represents the possible states an agent can be in
 * @public
 * @remarks
 * Defines the various states an agent can transition between during their session.
 * Common states include 'Available' (ready to handle interactions), 'Idle' (on break
 * or not ready), and 'RONA' (Response on No Answer).
 */
export type AgentState = 'Available' | 'Idle' | 'RONA' | string;

/**
 * Parameters required for changing an agent's state
 * @public
 * @remarks
 * Defines the necessary information for transitioning an agent from one state to another.
 */
export type StateChange = {
  /** New state to transition the agent to */
  state: AgentState;
  /** Auxiliary code ID associated with the state change */
  auxCodeId: string;
  /** Reason for the state change */
  lastStateChangeReason?: string;
  /** ID of the agent whose state is being changed */
  agentId?: string;
  /** V2: Specific channel types to change state for. When provided with V2 active, per-channel state change is used. */
  channelType?: ChannelType[];
};

/**
 * Parameters required for agent station login
 * @public
 * @remarks
 * Contains all the necessary information for logging an agent into their workstation,
 * including team assignments, roles, and device configurations.
 */
export type UserStationLogin = {
  /** Phone number for dialing */
  dialNumber?: string | null;
  /** Directory number */
  dn?: string | null;
  /** ID of the team the agent belongs to */
  teamId: string | null;
  /** Name of the team */
  teamName: string | null;
  /** List of roles assigned to the agent */
  roles?: Array<string>;
  /** ID of the site where the agent is located */
  siteId: string;
  /** Indicates if agent uses a different DN than their assigned one */
  usesOtherDN: boolean;
  /** ID of the agent's skill profile */
  skillProfileId?: string;
  /** ID of the initial auxiliary state code */
  auxCodeId: string;
  /** Indicates if login is via extension */
  isExtension?: boolean;
  /** Type of device being used */
  deviceType?: DeviceType;
  /** Unique identifier of the device */
  deviceId?: string | null;
  /** Flag indicating if emergency modal was shown */
  isEmergencyModalAlreadyDisplayed?: boolean;
};

/**
 * Available options for agent login methods
 * @public
 * @remarks
 * Defines the supported methods for agent login:
 * - AGENT_DN: Login using agent's direct number
 * - EXTENSION: Login using extension number
 * - BROWSER: Browser-based login
 */
export type LoginOption = 'AGENT_DN' | 'EXTENSION' | 'BROWSER';

/**
 * Type of device used for agent login
 * @public
 * @remarks
 * Represents the type of device being used for login. Can be one of the standard
 * LoginOptions or a custom device type string.
 */
export type DeviceType = LoginOption | string;

/**
 * Parameters for retrieving buddy agent information
 * @public
 * @remarks
 * Defines the criteria for fetching information about other agents (buddies)
 * in the system, allowing filtering by profile, media type, and state.
 */
export type BuddyAgents = {
  agentProfileId: string;
  mediaType: string;
  /** Filter for agent state eg : Available | Idle  */
  state?: string;
};

/**
 * Detailed information about a buddy agent
 * @public
 * @remarks
 * Contains comprehensive information about a buddy agent including their
 * current state, assignments, and contact information.
 */
export type BuddyDetails = {
  agentId: string;
  state: string;
  teamId: string;
  dn: string;
  agentName: string;
  siteId: string;
};

/**
 * Response type received when successfully retrieving buddy agent information
 * @public
 * @remarks
 * Contains the list of buddy agents and their details returned from a buddy
 * agent lookup request. Used for monitoring team member statuses and availability.
 */
export type BuddyAgentsSuccess = Msg<{
  /** Message type identifier for agent desktop events */
  eventType: 'AgentDesktopMessage';
  /** Unique identifier of the requesting agent */
  agentId: string;
  /** Tracking ID for the buddy list request */
  trackingId: string;
  /** Current session ID of the requesting agent */
  agentSessionId: string;
  /** Organization ID the agent belongs to */
  orgId: string;
  /** Type identifier for buddy agents response */
  type: 'BuddyAgents';
  /** List of buddy agents and their details */
  agentList: Array<BuddyDetails>;
}>;

/**
 * Events emitted by the agent service for various state changes and actions
 * @public
 * @remarks
 * Enumeration of all possible events that can be emitted by the agent service.
 * These events can be used to track and respond to changes in agent state,
 * login status, and other important agent-related activities.
 */
export enum AGENT_EVENTS {
  /** Emitted when an agent's state changes (e.g., Available to Idle) */
  AGENT_STATE_CHANGE = 'agent:stateChange',

  /** Emitted when multiple logins are detected for the same agent */
  AGENT_MULTI_LOGIN = 'agent:multiLogin',

  /** Emitted when an agent successfully logs into their station */
  AGENT_STATION_LOGIN_SUCCESS = 'agent:stationLoginSuccess',

  /** Emitted when station login attempt fails */
  AGENT_STATION_LOGIN_FAILED = 'agent:stationLoginFailed',

  /** Emitted when an agent successfully logs out */
  AGENT_LOGOUT_SUCCESS = 'agent:logoutSuccess',

  /** Emitted when logout attempt fails */
  AGENT_LOGOUT_FAILED = 'agent:logoutFailed',

  /** Emitted when an agent's directory number is successfully registered */
  AGENT_DN_REGISTERED = 'agent:dnRegistered',

  /** Emitted when an agent successfully re-authenticates */
  AGENT_RELOGIN_SUCCESS = 'agent:reloginSuccess',

  /** Emitted when the automated relogin (refresh or reconnect) finds no active session on the server */
  AGENT_RELOGIN_SESSION_NOT_FOUND = 'agent:reloginSessionNotFound',

  /** Emitted when the contact center WebSocket connection is lost */
  AGENT_CONNECTION_LOST = 'agent:connectionLost',

  /** Emitted when the contact center WebSocket reconnects, before the automated relogin runs */
  AGENT_CONNECTION_RECONNECTED = 'agent:connectionReconnected',

  /** Emitted when agent state change is successful */
  AGENT_STATE_CHANGE_SUCCESS = 'agent:stateChangeSuccess',

  /** Emitted when agent state change attempt fails */
  AGENT_STATE_CHANGE_FAILED = 'agent:stateChangeFailed',

  /** V2: Emitted when per-channel state change succeeds */
  AGENT_CHANNEL_STATE_CHANGE = 'agent:channelStateChange',

  /** V2: Emitted when per-channel state change fails */
  AGENT_CHANNEL_STATE_CHANGE_FAILED = 'agent:channelStateChangeFailed',

  /** V2: Emitted when V2 reload/relogin succeeds with per-channel state map */
  AGENT_CHANNEL_RELOGIN_SUCCESS = 'agent:channelReloginSuccess',

  /** V2: Emitted when channel recovery is deferred (e.g., telephony waiting for WebRTC line) */
  AGENT_CHANNEL_RECOVERY_DEFERRED = 'agent:channelRecoveryDeferred',
}

// ─── V2 Granular Agent State Control Types ────────────────────────────────────

/**
 * Channel types supported by V2 granular state control
 * @public
 */
export type ChannelType =
  | 'telephony'
  | 'chat'
  | 'email'
  | 'social'
  | 'workItem'
  | 'customMessaging';

/**
 * Per-channel state change request input for granular (V2) agent state.
 * Mirrors {@link StateChange} but targets specific channel types.
 * @public
 */
export type ChannelStateChangeRequest = {
  /** Target channel types */
  channelType: ChannelType[];
  /** Target state */
  state: AgentState;
  /** Auxiliary code ID */
  auxCodeId: string;
  /** Reason for the state change */
  reason?: string;
  /** Agent ID (defaults to current agent) */
  agentId?: string;
};

/**
 * Per-channel state detail from backend
 * @public
 */
export type AgentChannelTypeStates = {
  /** Current agent state on this channel */
  agentState: AgentState;
  /** Whether an idle state change is pending */
  pendingIdle: boolean;
  /** Auxiliary code ID for the current state */
  auxCodeId?: string;
  /** Number of available (open) channel slots */
  availableChannelCount: number;
  /** Total channel slots configured for this type */
  totalChannelCount: number;
  /** Number of manually assigned channel slots */
  manuallyAssignedChannelCount?: number;
  /** Total number of manually assigned channel slots */
  totalManuallyAssignedChannelCount?: number;
  /** Number of manually assigned channel slots currently available */
  manuallyAssignedAvailableChannelCount?: number | null;
  /** Human-readable reason for the state change */
  stateChangeReason: string;
  /** Unix timestamp (ms) of the state change */
  stateChangeTimestamp: number;
  /** Unix timestamp (ms) of the last idle code change */
  lastIdleCodeChangeTimestamp?: number;
};

/**
 * V2 channel state change success notification
 * @public
 */
export type AgentChannelStateChanged = Msg<{
  type: 'AgentChannelStateChanged';
  channelType: ChannelType;
  agentChannelStateDetail: AgentChannelTypeStates;
  subStatus: string;
  status: string;
  isClientInitiated: boolean;
  changedBy: string;
  changedById: string | null;
  changedByName: string | null;
  queueId?: string | null;
  eventTime?: number;
  connectedChannels: ChannelType[];
  isAgentLogin: boolean;
}>;

/**
 * V2 channel state change failure notification
 * @public
 */
export type AgentChannelStateChangeFailed = Msg<{
  type: 'AgentChannelStateChangeFailed';
  channelType: ChannelType;
  reason: string;
  reasonCode: number;
  isClientInitiated?: boolean;
  eventTime?: number;
}>;

/**
 * V2 channel relogin success notification
 * @public
 */
export type AgentChannelReloginSuccess = Msg<{
  type: 'AgentChannelReloginSuccess';
  agentChannelStateDetailMap: Record<ChannelType, AgentChannelTypeStates>;
  channelsMap: Record<string, string[]>;
  interactionIds: string[];
  reservedAgentChannelIds: string[];
  profileType: string;
  deviceType: string;
  dn: string;
  siteId: string;
  teamId: string;
  agentId: string;
  agentSessionId: string;
  trackingId: string;
  orgId: string;
  deviceId: string;
  isExtension: boolean;
  roles: string[];
  eventTime?: number;
}>;

/**
 * Map of channel type to its capacity (number of channel IDs)
 * @public
 */
export type ChannelsMap = Record<string, string[]>;

/**
 * Session version: V1 (agent-wide) or V2 (per-channel).
 * Pinned once per login session.
 * @public
 */
export type SessionVersion = 'V1' | 'V2';

/**
 * Session version control status for diagnostics/observability
 * @public
 */
export type AgentStateControlStatus = {
  /** Profile-derived V2 eligibility (manageChannelAvailability) */
  declared: boolean | undefined;
  /** Whether V2 granular agent state is active for this session */
  active: boolean | undefined;
};

// ─── V1 Bridge Types and Aggregate Functions ─────────────────────────────────

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
