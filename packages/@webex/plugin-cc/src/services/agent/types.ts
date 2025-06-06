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
    | 'User requested agent device change';
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

  /** Emitted when agent state change is successful */
  AGENT_STATE_CHANGE_SUCCESS = 'agent:stateChangeSuccess',

  /** Emitted when agent state change attempt fails */
  AGENT_STATE_CHANGE_FAILED = 'agent:stateChangeFailed',
}
