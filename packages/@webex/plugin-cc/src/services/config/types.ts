import * as Agent from '../agent/types';

type Enum<T extends Record<string, unknown>> = T[keyof T];

// Define the CC_EVENTS object
export const CC_EVENTS = {
  WELCOME: 'Welcome',
  AGENT_RELOGIN_SUCCESS: 'AgentReloginSuccess',
  AGENT_RELOGIN_FAILED: 'AgentReloginFailed',
  AGENT_LOGOUT: 'Logout',
  AGENT_LOGOUT_SUCCESS: 'AgentLogoutSuccess',
  AGENT_LOGOUT_FAILED: 'AgentLogoutFailed',
  AGENT_STATION_LOGIN: 'StationLogin',
  AGENT_STATION_LOGIN_SUCCESS: 'AgentStationLoginSuccess',
  AGENT_STATION_LOGIN_FAILED: 'AgentStationLoginFailed',
  AGENT_STATE_CHANGE: 'AgentStateChange',
  AGENT_MULTI_LOGIN: 'AGENT_MULTI_LOGIN',
  AGENT_STATE_CHANGE_SUCCESS: 'AgentStateChangeSuccess',
  AGENT_STATE_CHANGE_FAILED: 'AgentStateChangeFailed',
  AGENT_BUDDY_AGENTS: 'BuddyAgents',
  AGENT_BUDDY_AGENTS_SUCCESS: 'BuddyAgents',
  AGENT_BUDDY_AGENTS_RETRIEVE_FAILED: 'BuddyAgentsRetrieveFailed',
  AGENT_CONTACT_RESERVED: 'AgentContactReserved',
  AGENT_OFFER_CONTACT: 'AgentOfferContact',
  AGENT_CONTACT_ASSIGNED: 'AgentContactAssigned',
  AGENT_CONTACT_ASSIGN_FAILED: 'AgentContactAssignFailed',
  AGENT_CONTACT_OFFER_RONA: 'AgentOfferContactRona',
  AGENT_CONTACT_HELD: 'AgentContactHeld',
  AGENT_CONTACT_HOLD_FAILED: 'AgentContactHoldFailed',
  AGENT_CONTACT_UNHELD: 'AgentContactUnheld',
  AGENT_CONTACT_UNHOLD_FAILED: 'AgentContactUnHoldFailed',
  AGENT_CONSULT_CREATED: 'AgentConsultCreated',
  AGENT_OFFER_CONSULT: 'AgentOfferConsult',
  AGENT_CONSULTING: 'AgentConsulting',
  AGENT_CONSULT_FAILED: 'AgentConsultFailed',
  AGENT_CTQ_FAILED: 'AgentCtqFailed',
  AGENT_CTQ_CANCELLED: 'AgentCtqCancelled',
  AGENT_CTQ_CANCEL_FAILED: 'AgentCtqCancelFailed',
  AGENT_CONSULT_ENDED: 'AgentConsultEnded',
  AGENT_CONSULT_END_FAILED: 'AgentConsultEndFailed',
  AGENT_CONSULT_CONFERENCE_ENDED: 'AgentConsultConferenceEnded',
  AGENT_BLIND_TRANSFERRED: 'AgentBlindTransferred',
  AGENT_BLIND_TRANSFER_FAILED: 'AgentBlindTransferFailed',
  AGENT_VTEAM_TRANSFERRED: 'AgentVteamTransferred',
  AGENT_VTEAM_TRANSFER_FAILED: 'AgentVteamTransferFailed',
  AGENT_CONSULT_TRANSFERRING: 'AgentConsultTransferring',
  AGENT_CONSULT_TRANSFERRED: 'AgentConsultTransferred',
  AGENT_CONSULT_TRANSFER_FAILED: 'AgentConsultTransferFailed',
  CONTACT_RECORDING_PAUSED: 'ContactRecordingPaused',
  CONTACT_RECORDING_PAUSE_FAILED: 'ContactRecordingPauseFailed',
  CONTACT_RECORDING_RESUMED: 'ContactRecordingResumed',
  CONTACT_RECORDING_RESUME_FAILED: 'ContactRecordingResumeFailed',
  CONTACT_ENDED: 'ContactEnded',
  AGENT_CONTACT_END_FAILED: 'AgentContactEndFailed',
  AGENT_WRAPUP: 'AgentWrapup',
  AGENT_WRAPPEDUP: 'AgentWrappedUp',
  AGENT_WRAPUP_FAILED: 'AgentWrapupFailed',
  AGENT_OUTBOUND_FAILED: 'AgentOutboundFailed',
  AGENT_CONTACT: 'AgentContact',
} as const;

export type WelcomeEvent = {
  agentId: string;
};

export type WelcomeResponse = WelcomeEvent | Error;
// Derive the type using the utility type
export type CC_EVENTS = Enum<typeof CC_EVENTS>;

export type WebSocketEvent = {
  type: CC_EVENTS;
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

export type SubscribeResponse = {
  statusCode: number;
  body: {
    webSocketUrl?: string;
    subscriptionId?: string;
  };
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

export type TeamList = {
  id: string;
  name: string;
  active: boolean;
  userIds: string[];
  dbId?: string;
  desktopLayoutId?: string;
};

export type ListTeamsResponse = {
  data: TeamList[];
  meta: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalRecords: number;
  };
};

export type OrgInfo = {
  tenantId: string;
  timezone: string;
};

export type OrgSettings = {
  webRtcEnabled: boolean;
  maskSensitiveData: boolean;
  campaignManagerEnabled: boolean;
};

export type TenantData = {
  timeoutDesktopInactivityMins: number;
  forceDefaultDn: boolean;
  dnDefaultRegex: string;
  dnOtherRegex: string;
  privacyShieldVisible: boolean;
  outdialEnabled: boolean;
  endCallEnabled: boolean;
  endConsultEnabled: boolean;
  callVariablesSuppressed: boolean;
  timeoutDesktopInactivityEnabled: boolean;
  lostConnectionRecoveryTimeout: number;
};

export type URLMapping = {
  id: string;
  name: string;
  url: string;
  links: string[]; // Assuming 'links' is an array of strings, adjust if necessary
  createdTime: number; // Assuming timestamps are represented as numbers
  lastUpdatedTime: number;
};

export const IDLE_CODE = 'IDLE_CODE';
export const WRAP_UP_CODE = 'WRAP_UP_CODE';
export type AuxCodeType = typeof IDLE_CODE | typeof WRAP_UP_CODE;

type SortOrder = {
  property: string;
  order: string;
};

type SearchQuery = {
  properties: string;
  value: string;
};

export type QueryParams = {
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

export type Entity = {isSystem: boolean; name: string; id: string; isDefault: boolean};

export type DialPlanEntity = {
  id: string;
  regularExpression: string;
  prefix: string;
  strippedChars: string;
  name: string;
};

export type DialPlan = {
  type: string; // 'adhocDial'
  dialPlanEntity: {regex: string; prefix: string; strippedChars: string; name: string}[];
};

export type agentWrapUpCodes = {
  data: Entity[];
  meta: {
    links: {first: string; last: string; next: string; self: string};
    orgid: string;
    page: number;
    pageSize: number;
    totalPages: number;
    totalRecords: number;
  };
};

export type agentDefaultWrapupCode = {
  id: string;
  name: string;
};

export type WrapUpReason = {
  isSystem: boolean;
  name: string;
  id: string;
  isDefault: boolean;
};

export type WrapupData = {
  wrapUpProps: {
    autoWrapup?: boolean;
    autoWrapupInterval?: number;
    lastAgentRoute?: boolean;
    wrapUpReasonList: Array<WrapUpReason>;
    wrapUpCodesList?: Array<string>;
    idleCodesAccess?: 'ALL' | 'SPECIFIC';
    interactionId?: string;
    allowCancelAutoWrapup?: boolean;
  };
};

export type LoginOption = 'AGENT_DN' | 'EXTENSION' | 'BROWSER';

export type Team = {
  teamId: string;
  teamName: string;
  desktopLayoutId?: string;
};

export type Queue = {
  queueId: string;
  queueName: string;
};

export type URLMappings = {
  acqueonApiUrl: string;
  acqueonConsoleUrl: string;
};

/**
 * Represents the Agent Profile/configuration.
 * @public
 */
export type Profile = {
  microsoftConfig?: {
    showUserDetailsMS?: boolean;
    stateSynchronizationMS?: boolean;
  };
  webexConfig?: {
    showUserDetailsWebex?: boolean;
    stateSynchronizationWebex?: boolean;
  };
  teams: Team[];
  defaultDn: string;
  forceDefaultDn: boolean;
  forceDefaultDnForAgent: boolean;
  regexUS: RegExp | string;
  regexOther: RegExp | string;
  agentId: string;
  agentName: string;
  agentMailId: string;
  agentProfileID: string;
  dialPlan: DialPlan;
  skillProfileId: string;
  siteId: string;
  enterpriseId: string;
  privacyShieldVisible: boolean;
  idleCodes: Entity[];
  idleCodesList?: Array<string>;
  idleCodesAccess?: 'ALL' | 'SPECIFIC';
  wrapupCodes: Entity[];
  agentWrapUpCodes?: agentWrapUpCodes;
  agentDefaultWrapUpCode?: agentDefaultWrapupCode;
  defaultWrapupCode: string;
  wrapUpData: WrapupData;
  orgId?: string;
  isOutboundEnabledForTenant: boolean;
  isOutboundEnabledForAgent: boolean;
  isAdhocDialingEnabled: boolean;
  isAgentAvailableAfterOutdial: boolean;
  isCampaignManagementEnabled: boolean;
  outDialEp: string;
  isEndCallEnabled: boolean;
  isEndConsultEnabled: boolean;
  lcmUrl?: string;
  agentDbId: string;
  agentAnalyzerId?: string;
  allowConsultToQueue: boolean;
  campaignManagerAdditionalInfo?: string;
  agentPersonalStatsEnabled: boolean;
  addressBookId?: string;
  outdialANIId?: string;
  analyserUserId?: string;
  isCallMonitoringEnabled?: boolean;
  isMidCallMonitoringEnabled?: boolean;
  isBargeInEnabled?: boolean;
  isManagedTeamsEnabled?: boolean;
  isManagedQueuesEnabled?: boolean;
  isSendMessageEnabled?: boolean;
  isAgentStateChangeEnabled?: boolean;
  isSignOutAgentsEnabled?: boolean;
  urlMappings?: URLMappings;
  isTimeoutDesktopInactivityEnabled: boolean;
  timeoutDesktopInactivityMins?: number;
  isAnalyzerEnabled?: boolean;
  tenantTimezone?: string;
  loginVoiceOptions?: LoginOption[];
  deviceType?: LoginOption;
  webRtcEnabled: boolean;
  organizationIdleCodes?: Entity[];
  isRecordingManagementEnabled?: boolean;
  lostConnectionRecoveryTimeout: number;
  maskSensitiveData?: boolean;
  isAgentLoggedIn?: boolean;
  lastStateAuxCodeId?: string;
  lastStateChangeTimestamp?: number;
  lastIdleCodeChangeTimestamp?: number;
};
