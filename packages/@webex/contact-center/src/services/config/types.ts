import * as Agent from '../agent/types';

/**
 * Generic type for converting a const enum object into a union type of its values
 * @internal
 */
type Enum<T extends Record<string, unknown>> = T[keyof T];

/**
 * Events emitted on task objects
 * @enum {string}
 * @private
 * @ignore
 */
export const CC_TASK_EVENTS = {
  /** Event emitted when assigning contact to agent fails */
  AGENT_CONTACT_ASSIGN_FAILED: 'AgentContactAssignFailed',
  /** Event emitted when agent does not respond to contact offer */
  AGENT_CONTACT_OFFER_RONA: 'AgentOfferContactRona',
  /** Event emitted when contact is put on hold */
  AGENT_CONTACT_HELD: 'AgentContactHeld',
  /** Event emitted when putting contact on hold fails */
  AGENT_CONTACT_HOLD_FAILED: 'AgentContactHoldFailed',
  /** Event emitted when contact is taken off hold */
  AGENT_CONTACT_UNHELD: 'AgentContactUnheld',
  /** Event emitted when taking contact off hold fails */
  AGENT_CONTACT_UNHOLD_FAILED: 'AgentContactUnHoldFailed',
  /** Event emitted when consultation is created */
  AGENT_CONSULT_CREATED: 'AgentConsultCreated',
  /** Event emitted when consultation is offered */
  AGENT_OFFER_CONSULT: 'AgentOfferConsult',
  /** Event emitted when agent is consulting */
  AGENT_CONSULTING: 'AgentConsulting',
  /** Event emitted when consultation fails */
  AGENT_CONSULT_FAILED: 'AgentConsultFailed',
  /** Event emitted when consulting to queue (CTQ) fails */
  AGENT_CTQ_FAILED: 'AgentCtqFailed',
  /** Event emitted when CTQ is cancelled */
  AGENT_CTQ_CANCELLED: 'AgentCtqCancelled',
  /** Event emitted when CTQ cancellation fails */
  AGENT_CTQ_CANCEL_FAILED: 'AgentCtqCancelFailed',
  /** Event emitted when consultation ends */
  AGENT_CONSULT_ENDED: 'AgentConsultEnded',
  /** Event emitted when ending consultation fails */
  AGENT_CONSULT_END_FAILED: 'AgentConsultEndFailed',
  /** Event emitted when consultation conference ends */
  AGENT_CONSULT_CONFERENCE_ENDED: 'AgentConsultConferenceEnded',
  /** Event emitted when consultation conference is in progress */
  AGENT_CONSULT_CONFERENCING: 'AgentConsultConferencing',
  /** Event emitted when consultation conference starts */
  AGENT_CONSULT_CONFERENCED: 'AgentConsultConferenced',
  /** Event emitted when consultation conference fails */
  AGENT_CONSULT_CONFERENCE_FAILED: 'AgentConsultConferenceFailed',
  /** Event emitted when participant joins conference */
  PARTICIPANT_JOINED_CONFERENCE: 'ParticipantJoinedConference',
  /** Event emitted when participant leaves conference */
  PARTICIPANT_LEFT_CONFERENCE: 'ParticipantLeftConference',
  /** Event emitted when participant leaving conference fails */
  PARTICIPANT_LEFT_CONFERENCE_FAILED: 'ParticipantLeftConferenceFailed',
  /** Event emitted when consultation conference end fails */
  AGENT_CONSULT_CONFERENCE_END_FAILED: 'AgentConsultConferenceEndFailed',
  /** Event emitted when conference is successfully transferred */
  AGENT_CONFERENCE_TRANSFERRED: 'AgentConferenceTransferred',
  /** Event emitted when conference transfer fails */
  AGENT_CONFERENCE_TRANSFER_FAILED: 'AgentConferenceTransferFailed',
  /** Event emitted when consulted participant is moving/being transferred */
  CONSULTED_PARTICIPANT_MOVING: 'ConsultedParticipantMoving',
  /** Event emitted for post-call activity by participant */
  PARTICIPANT_POST_CALL_ACTIVITY: 'ParticipantPostCallActivity',
  /** Event emitted when contact is blind transferred */
  AGENT_BLIND_TRANSFERRED: 'AgentBlindTransferred',
  /** Event emitted when blind transfer fails */
  AGENT_BLIND_TRANSFER_FAILED: 'AgentBlindTransferFailed',
  /** Event emitted when contact is transferred to virtual team */
  AGENT_VTEAM_TRANSFERRED: 'AgentVteamTransferred',
  /** Event emitted when virtual team transfer fails */
  AGENT_VTEAM_TRANSFER_FAILED: 'AgentVteamTransferFailed',
  /** Event emitted when consultation transfer is in progress */
  AGENT_CONSULT_TRANSFERRING: 'AgentConsultTransferring',
  /** Event emitted when consultation transfer completes */
  AGENT_CONSULT_TRANSFERRED: 'AgentConsultTransferred',
  /** Event emitted when consultation transfer fails */
  AGENT_CONSULT_TRANSFER_FAILED: 'AgentConsultTransferFailed',
  /** Event emitted when contact recording is paused */
  CONTACT_RECORDING_PAUSED: 'ContactRecordingPaused',
  /** Event emitted when pausing contact recording fails */
  CONTACT_RECORDING_PAUSE_FAILED: 'ContactRecordingPauseFailed',
  /** Event emitted when contact recording is resumed */
  CONTACT_RECORDING_RESUMED: 'ContactRecordingResumed',
  /** Event emitted when resuming contact recording fails */
  CONTACT_RECORDING_RESUME_FAILED: 'ContactRecordingResumeFailed',
  /** Event emitted when contact ends */
  CONTACT_ENDED: 'ContactEnded',
  /** Event emitted when ending contact fails */
  AGENT_CONTACT_END_FAILED: 'AgentContactEndFailed',
  /** Event emitted when agent enters wrap-up state */
  AGENT_WRAPUP: 'AgentWrapup',
  /** Event emitted when agent completes wrap-up */
  AGENT_WRAPPEDUP: 'AgentWrappedUp',
  /** Event emitted when wrap-up fails */
  AGENT_WRAPUP_FAILED: 'AgentWrapupFailed',
  /** Event emitted when outbound call fails */
  AGENT_OUTBOUND_FAILED: 'AgentOutboundFailed',
  /** Event emitted for general agent contact events */
  AGENT_CONTACT: 'AgentContact',
  /** Event emitted when contact is offered to agent */
  AGENT_OFFER_CONTACT: 'AgentOfferContact',
  /** Event emitted when contact is assigned to agent */
  AGENT_CONTACT_ASSIGNED: 'AgentContactAssigned',
  /** Event emitted when contact is unassigned from agent */
  AGENT_CONTACT_UNASSIGNED: 'AgentContactUnassigned',
  /** Event emitted when inviting agent fails */
  AGENT_INVITE_FAILED: 'AgentInviteFailed',
} as const;

/**
 * Events emitted on Contact Center agent operations
 * @enum {string}
 * @private
 * @ignore
 */
export const CC_AGENT_EVENTS = {
  /** Welcome event when agent connects to websocket/backend */
  WELCOME: 'Welcome',
  /** Event emitted when agent re-login is successful */
  AGENT_RELOGIN_SUCCESS: 'AgentReloginSuccess',
  /** Event emitted when agent re-login fails */
  AGENT_RELOGIN_FAILED: 'AgentReloginFailed',
  /** Event emitted when agent DN registration completes */
  AGENT_DN_REGISTERED: 'AgentDNRegistered',
  /** Event emitted when agent initiates logout */
  AGENT_LOGOUT: 'Logout',
  /** Event emitted when agent logout is successful */
  AGENT_LOGOUT_SUCCESS: 'AgentLogoutSuccess',
  /** Event emitted when agent logout fails */
  AGENT_LOGOUT_FAILED: 'AgentLogoutFailed',
  /** Event emitted when agent initiates station login */
  AGENT_STATION_LOGIN: 'StationLogin',
  /** Event emitted when agent station login is successful */
  AGENT_STATION_LOGIN_SUCCESS: 'AgentStationLoginSuccess',
  /** Event emitted when agent station login fails */
  AGENT_STATION_LOGIN_FAILED: 'AgentStationLoginFailed',
  /** Event emitted when agent's state changes */
  AGENT_STATE_CHANGE: 'AgentStateChange',
  /** Event emitted when multiple logins detected for same agent */
  AGENT_MULTI_LOGIN: 'AGENT_MULTI_LOGIN',
  /** Event emitted when agent state change is successful */
  AGENT_STATE_CHANGE_SUCCESS: 'AgentStateChangeSuccess',
  /** Event emitted when agent state change fails */
  AGENT_STATE_CHANGE_FAILED: 'AgentStateChangeFailed',
  /** Event emitted when requesting buddy agents list */
  AGENT_BUDDY_AGENTS: 'BuddyAgents',
  /** Event emitted when buddy agents list is successfully retrieved */
  AGENT_BUDDY_AGENTS_SUCCESS: 'BuddyAgents',
  /** Event emitted when retrieving buddy agents list fails */
  AGENT_BUDDY_AGENTS_RETRIEVE_FAILED: 'BuddyAgentsRetrieveFailed',
  /** Event emitted when contact is reserved for agent */
  AGENT_CONTACT_RESERVED: 'AgentContactReserved',
} as const;

/**
 * Combined Contact Center events including both agent and task events
 * @enum {string}
 * @public
 */
export const CC_EVENTS = {
  ...CC_AGENT_EVENTS,
  ...CC_TASK_EVENTS,
} as const;

/**
 * Event data received when agent connects to the system
 * @public
 */
export type WelcomeEvent = {
  /** ID of the agent that connected */
  agentId: string;
};

/**
 * Response type for welcome events which can be either success or error
 * @public
 */
export type WelcomeResponse = WelcomeEvent | Error;

/**
 * Type representing the union of all possible Contact Center events
 * @public
 */
export type CC_EVENTS = Enum<typeof CC_EVENTS>;

/**
 * WebSocket event structure for Contact Center events
 * @public
 */
export type WebSocketEvent = {
  /** Type of the event */
  type: CC_EVENTS;
  /** Event payload data */
  data:
    | WelcomeEvent
    | Agent.StationLoginSuccess
    | Agent.LogoutSuccess
    | Agent.ReloginSuccess
    | Agent.StateChangeSuccess
    | Agent.BuddyAgentsSuccess;
};

/**
 * Represents the response from getUserUsingCI method.
 */
export type AgentResponse = {
  /**
   * ID of the agent.
   */
  id: string;

  /**
   * The ciUserId of the agent.
   */
  ciUserId: string;

  /**
   * The first name of the agent.
   */
  firstName: string;

  /**
   * The last name of the agent.
   */
  lastName: string;

  /**
   * Identifier for a Desktop Profile.
   */
  agentProfileId: string;

  /**
   * The email address of the agent.
   */
  email: string;

  /**
   * Team IDs assigned to the agent.
   */
  teamIds: string[];

  /**
   * Multimedia profile ID associated with the agent.
   */
  multimediaProfileId: string;

  /**
   * Skill profile ID of the agent.
   */
  skillProfileId: string;

  /**
   * Site ID of the agent.
   */
  siteId: string;

  /**
   * Database ID of the agent.
   */
  dbId?: string;

  /**
   * The default dialed number of the agent.
   */
  defaultDialledNumber?: string;
};

/**
 * Represents the response from getDesktopProfileById method.
 */
export type DesktopProfileResponse = {
  /**
   * Represents the voice options of an agent.
   */
  loginVoiceOptions: LoginOption[];

  /**
   * Wrap-up codes that the agents can select when they wrap up a contact. It can take one of these values: ALL - To make all wrap-up codes available. SPECIFIC - To make specific codes available.
   */
  accessWrapUpCode: string;

  /**
   * Idle codes that the agents can select in Agent Desktop. It can take one of these values: ALL - To make all idle codes available. SPECIFIC - To make specific codes available.
   */
  accessIdleCode: string;

  /**
   * Wrap-up codes list that the agents can select when they wrap up a contact.
   */
  wrapUpCodes: string[];

  /**
   * Idle codes list that the agents can select in Agent Desktop.
   */
  idleCodes: string[];

  /**
   * Dial plan enabled for the agent.
   */
  dialPlanEnabled: boolean;

  /**
   * Last agent routing enabled for the agent.
   */
  lastAgentRouting: boolean;

  /**
   * Auto wrap-up allowed.
   */
  autoWrapUp: boolean;

  /**
   * Auto answer allowed.
   */
  autoAnswer: boolean;

  /**
   * Auto wrap-up after seconds.
   */
  autoWrapAfterSeconds: number;

  /**
   * Agent available after outdial.
   */
  agentAvailableAfterOutdial: boolean;

  /**
   * Allow auto wrap-up extension.
   */
  allowAutoWrapUpExtension: boolean;

  /**
   * Outdial enabled for the agent.
   */
  outdialEnabled: boolean;

  /**
   * Outdial entry point ID of the agent.
   */
  outdialEntryPointId: string;

  /**
   * Outdial ANI ID of the agent.
   */
  outdialANIId: string;

  /**
   * Consult to queue allowed.
   */
  consultToQueue: boolean;

  /**
   * Address book ID of the agent.
   */
  addressBookId: string;

  /**
   * Viewable statistics of the agent.
   */
  viewableStatistics: {
    id: string;
    agentStats: boolean;
    accessQueueStats: string;
    contactServiceQueues: string[];
    loggedInTeamStats: boolean;
    accessTeamStats: string;
    teams: string[];
  };

  /**
   * Agent DN validation of the agent.
   */
  agentDNValidation: string;

  /**
   * Dial plans of the agent.
   */
  dialPlans: string[];

  /**
   * Timeout desktop inactivity custom enabled.
   */
  timeoutDesktopInactivityCustomEnabled: boolean;

  /**
   * Timeout desktop inactivity minutes.
   */
  timeoutDesktopInactivityMins: number;

  /**
   * Show user details in Microsoft enabled or not.
   */
  showUserDetailsMS: boolean;

  /**
   * State synchronization in Microsoft enabled or not.
   */
  stateSynchronizationMS: boolean;

  /**
   * Show user details in Webex enabled or not.
   */
  showUserDetailsWebex: boolean;

  /**
   * State synchronization in Webex enabled or not.
   */
  stateSynchronizationWebex: boolean;
};

/**
 * Response containing multimedia profile configuration for an agent
 * Defines capabilities across different communication channels
 * @private
 */
export type MultimediaProfileResponse = {
  /** Organization identifier */
  organizationId: string;
  /** Profile identifier */
  id: string;
  /** Version number of the profile */
  version: number;
  /** Profile name */
  name: string;
  /** Profile description */
  description: string;
  /** Maximum number of concurrent chat interactions */
  chat: number;
  /** Maximum number of concurrent email interactions */
  email: number;
  /** Maximum number of concurrent voice interactions */
  telephony: number;
  /** Maximum number of concurrent social media interactions */
  social: number;
  /** Whether the profile is active */
  active: boolean;
  /** Whether channel blending is enabled */
  blendingModeEnabled: boolean;
  /** Type of blending mode configuration */
  blendingMode: string;
  /** Whether this is the system default profile */
  systemDefault: boolean;
  /** Timestamp when profile was created */
  createdTime: number;
  /** Timestamp when profile was last updated */
  lastUpdatedTime: number;
};

/**
 * Response from subscription requests containing WebSocket connection details
 * @public
 */
export type SubscribeResponse = {
  /** HTTP status code of the response */
  statusCode: number;
  /** Response body containing connection details */
  body: {
    /** WebSocket URL for real-time updates */
    webSocketUrl?: string;
    /** Unique subscription identifier */
    subscriptionId?: string;
  };
  /** Optional status or error message */
  message: string | null;
};

export type AuxCode = {
  /**
   * ID of the Auxiliary Code.
   */
  id: string;

  /**
   * Indicates whether the auxiliary code is active or not.
   */
  active: boolean;

  /**
   * Indicates whether this is the default code (true) or not (false).
   */
  defaultCode: boolean;

  /**
   * Indicates whether this is the system default code (true) or not (false).
   */
  isSystemCode: boolean;

  /**
   * A short description indicating the context of the code.
   */
  description: string;

  /**
   * Name of the Auxiliary Code.
   */
  name: string;

  /**
   * Indicates the work type associated with this code.
   */
  workTypeCode: string;
};

export type ListAuxCodesResponse = {
  data: AuxCode[];
  meta: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalRecords: number;
  };
};

/**
 * Configuration for a team in the contact center system
 * @private
 */
export type TeamList = {
  /** Unique identifier for the team */
  id: string;
  /** Team name */
  name: string;
  /** Type of team (e.g., 'AGENT_BASED') */
  teamType: string;
  /** Current status of the team */
  teamStatus: string;
  /** Whether the team is active */
  active: boolean;
  /** Site identifier where team is located */
  siteId: string;
  /** Name of the site */
  siteName: string;
  /** Optional multimedia profile ID for team */
  multiMediaProfileId?: string;
  /** List of user IDs belonging to team */
  userIds: string[];
  /** Whether queue rankings are enabled for team */
  rankQueuesForTeam: boolean;
  /** Ordered list of queue rankings */
  queueRankings: string[];
  /** Optional database identifier */
  dbId?: string;
  /** Optional desktop layout identifier */
  desktopLayoutId?: string;
};

/**
 * Response type for listing teams with pagination metadata
 * @private
 */
export type ListTeamsResponse = {
  /** Array of team configurations */
  data: TeamList[];
  /** Pagination metadata */
  meta: {
    /** Current page number */
    page: number;
    /** Number of items per page */
    pageSize: number;
    /** Total number of pages */
    totalPages: number;
    /** Total number of records */
    totalRecords: number;
  };
};

/**
 * Basic organization information in the contact center system
 * @private
 * @ignore
 */
export type OrgInfo = {
  /** Tenant identifier */
  tenantId: string;
  /** Organization timezone */
  timezone: string;
};

/**
 * Organization-wide feature settings and configurations
 * @private
 */
export type OrgSettings = {
  /** Whether WebRTC functionality is enabled */
  webRtcEnabled: boolean;
  /** Whether sensitive data masking is enabled */
  maskSensitiveData: boolean;
  /** Whether campaign manager features are enabled */
  campaignManagerEnabled: boolean;
};

/**
 * Contact center site configuration information
 * @private
 */
export type SiteInfo = {
  /** Unique site identifier */
  id: string;
  /** Site name */
  name: string;
  /** Whether site is active */
  active: boolean;
  /** Multimedia profile ID for site */
  multimediaProfileId: string;
  /** Whether this is the system default site */
  systemDefault: boolean;
};

/**
 * Tenant-level configuration data and settings
 * @private
 */
export type TenantData = {
  /** Desktop inactivity timeout in minutes */
  timeoutDesktopInactivityMins: number;
  /** Whether default DN is enforced */
  forceDefaultDn: boolean;
  /** Regex pattern for default DN validation */
  dnDefaultRegex: string;
  /** Regex pattern for other DN validation */
  dnOtherRegex: string;
  /** Whether privacy shield feature is visible */
  privacyShieldVisible: boolean;
  /** Whether outbound dialing is enabled */
  outdialEnabled: boolean;
  /** Whether ending calls is enabled */
  endCallEnabled: boolean;
  /** Whether ending consultations is enabled */
  endConsultEnabled: boolean;
  /** Whether call variables are suppressed */
  callVariablesSuppressed: boolean;
  /** Whether desktop inactivity timeout is enabled */
  timeoutDesktopInactivityEnabled: boolean;
  /** Lost connection recovery timeout in seconds */
  lostConnectionRecoveryTimeout: number;
};

/**
 * URL mapping configuration for external integrations
 * @public
 */
export type URLMapping = {
  id: string;
  name: string;
  url: string;
  links: string[]; // Assuming 'links' is an array of strings, adjust if necessary
  createdTime: number; // Assuming timestamps are represented as numbers
  lastUpdatedTime: number;
};

/**
 * Constant representing idle code
 * @public
 * @ignore
 */
export const IDLE_CODE = 'IDLE_CODE';

/**
 * Constant representing wrap up code
 * @public
 * @ignore
 */
export const WRAP_UP_CODE = 'WRAP_UP_CODE';

/**
 * Type representing the possible auxiliary code types
 * @public
 */
export type AuxCodeType = typeof IDLE_CODE | typeof WRAP_UP_CODE;

/**
 * Sort order configuration for queries
 * @internal
 */
type SortOrder = {
  /** Property to sort by */
  property: string;
  /** Sort order direction */
  order: string;
};

/**
 * Search query configuration
 * @internal
 */
type SearchQuery = {
  /** Properties to search in */
  properties: string;
  /** Search value */
  value: string;
};

/**
 * Parameters for querying Contact Center resources
 * @public
 */
export type QueryParams = {
  /** Page number for pagination */
  pageNumber?: number;
  pageSize?: number;
  attributes?: Array<string>;
  ids?: Array<string>;
  queueType?: string;
  entryPointType?: string;
  channelType?: string;
  isActive?: boolean;
  workTypeCode?: AuxCodeType;
  names?: Array<string>;
  sortOrder?: SortOrder;
  searchQuery?: SearchQuery;
  defaultCode?: boolean;
  search?: string;
  desktopProfileFilter?: boolean;
};

/**
 * Basic entity information used throughout the system
 * @public
 */
export type Entity = {
  /** Whether this is a system entity */
  isSystem: boolean;
  /** Entity name */
  name: string;
  /** Unique entity identifier */
  id: string;
  /** Whether this is the default entity */
  isDefault: boolean;
};

/**
 * Dial plan entity definition containing number manipulation rules
 * @public
 */
export type DialPlanEntity = {
  /** Unique identifier for the dial plan */
  id: string;
  /** Regular expression pattern for matching numbers */
  regularExpression: string;
  /** Prefix to add to matched numbers */
  prefix: string;
  /** Characters to strip from matched numbers */
  strippedChars: string;
  /** Name of the dial plan */
  name: string;
};

/**
 * Complete dial plan configuration for number handling
 * @public
 */
export type DialPlan = {
  /** Type of dial plan (e.g., 'adhocDial') */
  type: string;
  /** List of dial plan entities with transformation rules */
  dialPlanEntity: {
    /** Regular expression pattern */
    regex: string;
    /** Number prefix */
    prefix: string;
    /** Characters to strip */
    strippedChars: string;
    /** Entity name */
    name: string;
  }[];
};

/**
 * Agent wrap-up codes configuration with pagination metadata
 * @public
 */
export type agentWrapUpCodes = {
  /** Array of wrap-up code entities */
  data: Entity[];
  /** Pagination and navigation metadata */
  meta: {
    /** Navigation URLs for pagination */
    links: {
      /** URL for first page */
      first: string;
      /** URL for last page */
      last: string;
      /** URL for next page */
      next: string;
      /** URL for current page */
      self: string;
    };
    /** Organization identifier */
    orgid: string;
    /** Current page number */
    page: number;
    /** Number of items per page */
    pageSize: number;
    /** Total number of pages */
    totalPages: number;
    /** Total number of records */
    totalRecords: number;
  };
};

/**
 * Default wrap-up code configuration for an agent
 * @public
 */
export type agentDefaultWrapupCode = {
  /** Unique identifier for the wrap-up code */
  id: string;
  /** Display name of the wrap-up code */
  name: string;
};

/**
 * Wrap-up reason configuration used to classify completed interactions
 * @public
 */
export type WrapUpReason = {
  /** Whether this is a system-defined reason */
  isSystem: boolean;
  /** Display name of the reason */
  name: string;
  /** Unique identifier */
  id: string;
  /** Whether this is the default reason */
  isDefault: boolean;
};

/**
 * Wrap-up configuration data containing settings and available options
 * @public
 */
export type WrapupData = {
  /** Wrap-up configuration properties */
  wrapUpProps: {
    /** Whether automatic wrap-up is enabled */
    autoWrapup?: boolean;
    /** Time in seconds before auto wrap-up triggers */
    autoWrapupInterval?: number;
    /** Whether last agent routing is enabled */
    lastAgentRoute?: boolean;
    /** List of available wrap-up reasons */
    wrapUpReasonList: Array<WrapUpReason>;
    /** List of available wrap-up codes */
    wrapUpCodesList?: Array<string>;
    /** Access control for idle codes ('ALL' or 'SPECIFIC') */
    idleCodesAccess?: 'ALL' | 'SPECIFIC';
    /** Associated interaction identifier */
    interactionId?: string;
    /** Whether cancelling auto wrap-up is allowed */
    allowCancelAutoWrapup?: boolean;
  };
};

/**
 * Available login options for voice channel access
 * 'AGENT_DN' - Login using agent's DN
 * 'EXTENSION' - Login using extension number
 * 'BROWSER' - Login using browser-based WebRTC
 * @public
 */
export type LoginOption = 'AGENT_DN' | 'EXTENSION' | 'BROWSER';

/**
 * Team configuration information
 * @public
 */
export type Team = {
  /** Unique team identifier */
  teamId: string;
  /** Team display name */
  teamName: string;
  /** Optional desktop layout configuration identifier */
  desktopLayoutId?: string;
};

/**
 * Basic queue configuration information
 * @public
 */
export type Queue = {
  /** Queue identifier */
  queueId: string;
  /** Queue display name */
  queueName: string;
};

/**
 * URL mappings for external system integrations
 * @public
 */
export type URLMappings = {
  /** Acqueon API endpoint URL */
  acqueonApiUrl: string;
  /** Acqueon console URL */
  acqueonConsoleUrl: string;
};

/**
 * Comprehensive agent profile configuration in the contact center system
 * Contains all settings and capabilities for an agent
 * @public
 */
export type Profile = {
  /** Microsoft Teams integration configuration */
  microsoftConfig?: {
    /** Whether to show user details in Teams */
    showUserDetailsMS?: boolean;
    /** Whether to sync agent state with Teams */
    stateSynchronizationMS?: boolean;
  };
  /** Webex integration configuration */
  webexConfig?: {
    /** Whether to show user details in Webex */
    showUserDetailsWebex?: boolean;
    /** Whether to sync agent state with Webex */
    stateSynchronizationWebex?: boolean;
  };
  /** List of teams the agent belongs to */
  teams: Team[];
  /** Agent's default dial number */
  defaultDn: string;
  dn?: string;
  /** Whether default DN is enforced at tenant level */
  forceDefaultDn: boolean;
  /** Whether default DN is enforced for this agent */
  forceDefaultDnForAgent: boolean;
  /** Regex pattern for US phone number validation */
  regexUS: RegExp | string;
  /** Regex pattern for international phone number validation */
  regexOther: RegExp | string;
  /** Unique identifier for the agent */
  agentId: string;
  /** Display name for the agent */
  agentName: string;
  /** Email address for the agent */
  agentMailId: string;
  /** Agent's profile configuration ID */
  agentProfileID: string;
  /** Dial plan configuration for number handling */
  dialPlan: DialPlan;
  /** Multimedia profile defining channel capabilities */
  multimediaProfileId: string;
  /** Skill profile defining agent competencies */
  skillProfileId: string;
  /** Site where agent is located */
  siteId: string;
  /** Enterprise-wide identifier */
  enterpriseId: string;
  /** Whether privacy shield feature is visible */
  privacyShieldVisible: boolean;
  /** Available idle codes */
  idleCodes: Entity[];
  /** List of specific idle codes */
  idleCodesList?: Array<string>;
  /** Access control for idle codes */
  idleCodesAccess?: 'ALL' | 'SPECIFIC';
  /** Available wrap-up codes */
  wrapupCodes: Entity[];
  /** Agent-specific wrap-up codes */
  agentWrapUpCodes?: agentWrapUpCodes;
  /** Default wrap-up code for agent */
  agentDefaultWrapUpCode?: agentDefaultWrapupCode;
  /** Default wrap-up code identifier */
  defaultWrapupCode: string;
  /** Wrap-up configuration data */
  wrapUpData: WrapupData;
  /** Organization identifier */
  orgId?: string;
  /** Whether outbound is enabled at tenant level */
  isOutboundEnabledForTenant: boolean;
  /** Whether outbound is enabled for this agent */
  isOutboundEnabledForAgent: boolean;
  /** Whether ad-hoc dialing is enabled */
  isAdhocDialingEnabled: boolean;
  /** Whether agent becomes available after outdial */
  isAgentAvailableAfterOutdial: boolean;
  /** Whether campaign management is enabled */
  isCampaignManagementEnabled: boolean;
  /** Outbound entry point */
  outDialEp: string;
  /** Whether ending calls is enabled */
  isEndCallEnabled: boolean;
  /** Whether ending consultations is enabled */
  isEndConsultEnabled: boolean;
  /** Optional lifecycle manager URL */
  lcmUrl?: string;
  /** Database identifier for agent */
  agentDbId: string;
  /** Optional analyzer identifier for agent */
  agentAnalyzerId?: string;
  /** Whether consult to queue is allowed */
  allowConsultToQueue: boolean;
  /** Additional campaign manager information */
  campaignManagerAdditionalInfo?: string;
  /** Whether personal statistics are enabled */
  agentPersonalStatsEnabled: boolean;
  /** Optional address book identifier */
  addressBookId?: string;
  /** Optional outbound ANI identifier */
  outdialANIId?: string;
  /** Optional analyzer user identifier */
  analyserUserId?: string;
  /** Whether call monitoring is enabled */
  isCallMonitoringEnabled?: boolean;
  /** Whether mid-call monitoring is enabled */
  isMidCallMonitoringEnabled?: boolean;
  /** Whether barge-in functionality is enabled */
  isBargeInEnabled?: boolean;
  /** Whether managed teams feature is enabled */
  isManagedTeamsEnabled?: boolean;
  /** Whether managed queues feature is enabled */
  isManagedQueuesEnabled?: boolean;
  /** Whether sending messages is enabled */
  isSendMessageEnabled?: boolean;
  /** Whether agent state changes are enabled */
  isAgentStateChangeEnabled?: boolean;
  /** Whether signing out agents is enabled */
  isSignOutAgentsEnabled?: boolean;
  /** Integration URL mappings */
  urlMappings?: URLMappings;
  /** Whether desktop inactivity timeout is enabled */
  isTimeoutDesktopInactivityEnabled: boolean;
  /** Desktop inactivity timeout in minutes */
  timeoutDesktopInactivityMins?: number;
  /** Whether analyzer features are enabled */
  isAnalyzerEnabled?: boolean;
  /** Tenant timezone */
  tenantTimezone?: string;
  /** Available voice login options */
  loginVoiceOptions?: LoginOption[];
  /** Current login device type */
  deviceType?: LoginOption;
  /** Current team identifier */
  currentTeamId?: string;
  /** Whether WebRTC is enabled */
  webRtcEnabled: boolean;
  /** Organization-wide idle codes */
  organizationIdleCodes?: Entity[];
  /** Whether recording management is enabled */
  isRecordingManagementEnabled?: boolean;
  /** Connection recovery timeout in milliseconds */
  lostConnectionRecoveryTimeout: number;
  /** Whether sensitive data masking is enabled */
  maskSensitiveData?: boolean;
  /** Whether agent is currently logged in */
  isAgentLoggedIn?: boolean;
  /** Last auxiliary code ID used for state change */
  lastStateAuxCodeId?: string;
  /** Timestamp of last state change */
  lastStateChangeTimestamp?: number;
  /** Timestamp of last idle code change */
  lastIdleCodeChangeTimestamp?: number;
};

/**
 * Contact distribution group configuration for routing logic
 * @public
 */
export type CallDistributionGroup = {
  /** List of agent groups in this distribution group */
  agentGroups: {
    /** Team identifier */
    teamId: string;
  }[];
  /** Distribution order priority */
  order: number;
  /** Distribution time duration in seconds */
  duration: number;
};
