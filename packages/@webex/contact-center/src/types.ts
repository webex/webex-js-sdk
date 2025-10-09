import {CallingClientConfig} from '@webex/calling';
import {
  SubmitBehavioralEvent,
  SubmitOperationalEvent,
  SubmitBusinessEvent,
} from '@webex/internal-plugin-metrics/src/metrics.types';
import * as Agent from './services/agent/types';
import * as Contact from './services/task/types';
import {Profile} from './services/config/types';
import {PaginatedResponse, BaseSearchParams} from './utils/PageCache';

/**
 * Generic type for converting a const enum object into a union type of its values.
 * @template T The enum object type
 * @internal
 * @ignore
 */
type Enum<T extends Record<string, unknown>> = T[keyof T];

/**
 * HTTP methods supported by WebexRequest.
 * @enum {string}
 * @public
 * @example
 * const method: HTTP_METHODS = HTTP_METHODS.GET;
 * @ignore
 */
export const HTTP_METHODS = {
  /** HTTP GET method for retrieving data */
  GET: 'GET',
  /** HTTP POST method for creating resources */
  POST: 'POST',
  /** HTTP PATCH method for partial updates */
  PATCH: 'PATCH',
  /** HTTP PUT method for complete updates */
  PUT: 'PUT',
  /** HTTP DELETE method for removing resources */
  DELETE: 'DELETE',
} as const;

/**
 * Union type of HTTP methods.
 * @public
 * @example
 * function makeRequest(method: HTTP_METHODS) { ... }
 * @ignore
 */
export type HTTP_METHODS = Enum<typeof HTTP_METHODS>;

/**
 * Payload for making requests to Webex APIs.
 * @public
 * @example
 * const payload: WebexRequestPayload = {
 *   service: 'identity',
 *   resource: '/users',
 *   method: HTTP_METHODS.GET
 * };
 * @ignore
 */
export type WebexRequestPayload = {
  /** Service name to target */
  service?: string;
  /** Resource path within the service */
  resource?: string;
  /** HTTP method to use */
  method?: HTTP_METHODS;
  /** Full URI if not using service/resource pattern */
  uri?: string;
  /** Whether to add authorization header */
  addAuthHeader?: boolean;
  /** Custom headers to include in request */
  headers?: {
    [key: string]: string | null;
  };
  /** Request body data */
  body?: object;
  /** Expected response status code */
  statusCode?: number;
  /** Whether to parse response as JSON */
  json?: boolean;
};

/**
 * Event listener function type.
 * @internal
 * @ignore
 */
type Listener = (e: string, data?: unknown) => void;

/**
 * Event listener removal function type.
 * @internal
 * @ignore
 */
type ListenerOff = (e: string) => void;

/**
 * Service host configuration.
 * @internal
 * @ignore
 */
type ServiceHost = {
  /** Host URL/domain for the service */
  host: string;
  /** Time-to-live in seconds */
  ttl: number;
  /** Priority level for load balancing (lower is higher priority) */
  priority: number;
  /** Unique identifier for this host */
  id: string;
  /** Whether this is the home cluster for the user */
  homeCluster?: boolean;
};

/**
 * Configuration options for the Contact Center Plugin.
 * @interface CCPluginConfig
 * @public
 * @example
 * const config: CCPluginConfig = {
 *   allowMultiLogin: true,
 *   allowAutomatedRelogin: false,
 *   clientType: 'browser',
 *   isKeepAliveEnabled: true,
 *   force: false,
 *   metrics: { clientName: 'myClient', clientType: 'browser' },
 *   logging: { enable: true, verboseEvents: false },
 *   callingClientConfig: { ... }
 * };
 */
export interface CCPluginConfig {
  /** Whether to allow multiple logins from different devices */
  allowMultiLogin: boolean;
  /** Whether to automatically attempt relogin on connection loss */
  allowAutomatedRelogin: boolean;
  /** The type of client making the connection */
  clientType: string;
  /** Whether to enable keep-alive messages */
  isKeepAliveEnabled: boolean;
  /** Whether to force registration */
  force: boolean;
  /** Metrics configuration */
  metrics: {
    /** Name of the client for metrics */
    clientName: string;
    /** Type of client for metrics */
    clientType: string;
  };
  /** Logging configuration */
  logging: {
    /** Whether to enable logging */
    enable: boolean;
    /** Whether to log verbose events */
    verboseEvents: boolean;
  };
  /** Configuration for the calling client */
  callingClientConfig: CallingClientConfig;
}

/**
 * Logger interface for standardized logging throughout the plugin.
 * @public
 * @example
 * logger.log('This is a log message');
 * logger.error('This is an error message');
 * @ignore
 */
export type Logger = {
  /** Log general messages */
  log: (payload: string) => void;
  /** Log error messages */
  error: (payload: string) => void;
  /** Log warning messages */
  warn: (payload: string) => void;
  /** Log informational messages */
  info: (payload: string) => void;
  /** Log detailed trace messages */
  trace: (payload: string) => void;
  /** Log debug messages */
  debug: (payload: string) => void;
};

/**
 * Contextual information for log entries.
 * @public
 * @ignore
 */
export interface LogContext {
  /** Module name where the log originated */
  module?: string;
  /** Method name where the log originated */
  method?: string;
  interactionId?: string;
  trackingId?: string;
  /** Additional structured data to include in logs */
  data?: Record<string, any>;
  /** Error object to include in logs */
  error?: Error | unknown;
}

/**
 * Available logging severity levels.
 * @enum {string}
 * @public
 * @example
 * const level: LOGGING_LEVEL = LOGGING_LEVEL.error;
 * @ignore
 */
export enum LOGGING_LEVEL {
  /** Critical failures that require immediate attention */
  error = 'ERROR',
  /** Important issues that don't prevent the system from working */
  warn = 'WARN',
  /** General informational logs */
  log = 'LOG',
  /** Detailed information about system operation */
  info = 'INFO',
  /** Highly detailed diagnostic information */
  trace = 'TRACE',
}

/**
 * Metadata for log uploads.
 * @public
 * @example
 * const meta: LogsMetaData = { feedbackId: 'fb123', correlationId: 'corr456' };
 * @ignore
 */
export type LogsMetaData = {
  /** Optional feedback ID to associate with logs */
  feedbackId?: string;
  /** Optional correlation ID to track related operations */
  correlationId?: string;
};

/**
 * Response from uploading logs to the server.
 * @public
 * @example
 * const response: UploadLogsResponse = { trackingid: 'track123', url: 'https://...', userId: 'user1' };
 */
export type UploadLogsResponse = {
  /** Tracking ID for the upload request */
  trackingid?: string;
  /** URL where the logs can be accessed */
  url?: string;
  /** ID of the user who uploaded logs */
  userId?: string;
  /** Feedback ID associated with the logs */
  feedbackId?: string;
  /** Correlation ID for tracking related operations */
  correlationId?: string;
};

/**
 * Internal Webex SDK interfaces needed for plugin integration.
 * @internal
 * @ignore
 */
interface IWebexInternal {
  /** Mercury service for real-time messaging */
  mercury: {
    /** Register an event listener */
    on: Listener;
    /** Remove an event listener */
    off: ListenerOff;
    /** Establish a connection to the Mercury service */
    connect: () => Promise<void>;
    /** Disconnect from the Mercury service */
    disconnect: () => Promise<void>;
    /** Whether Mercury is currently connected */
    connected: boolean;
    /** Whether Mercury is in the process of connecting */
    connecting: boolean;
  };
  /** Device information */
  device: {
    /** Current WDM URL */
    url: string;
    /** Current user's ID */
    userId: string;
    /** Current organization ID */
    orgId: string;
    /** Device version */
    version: string;
    /** Calling behavior configuration */
    callingBehavior: string;
  };
  /** Presence service */
  presence: unknown;
  /** Services discovery and management */
  services: {
    /** Get a service URL by name */
    get: (service: string) => string;
    /** Wait for service catalog to be loaded */
    waitForCatalog: (service: string) => Promise<void>;
    /** Host catalog for service discovery */
    _hostCatalog: Record<string, ServiceHost[]>;
    /** Service URLs cache */
    _serviceUrls: {
      /** Mobius calling service */
      mobius: string;
      /** Identity service */
      identity: string;
      /** Janus media server */
      janus: string;
      /** WDM (WebEx Device Management) service */
      wdm: string;
      /** BroadWorks IDP proxy service */
      broadworksIdpProxy: string;
      /** Hydra API service */
      hydra: string;
      /** Mercury API service */
      mercuryApi: string;
      /** UC Management gateway service */
      'ucmgmt-gateway': string;
      /** Contacts service */
      contactsService: string;
    };
  };
  /** Metrics collection services */
  newMetrics: {
    /** Submit behavioral events (user actions) */
    submitBehavioralEvent: SubmitBehavioralEvent;
    /** Submit operational events (system operations) */
    submitOperationalEvent: SubmitOperationalEvent;
    /** Submit business events (business outcomes) */
    submitBusinessEvent: SubmitBusinessEvent;
  };
  /** Support functionality */
  support: {
    /** Submit logs to server */
    submitLogs: (
      metaData: LogsMetaData,
      logs: string,
      options: {
        /** Whether to submit full logs or just differences */
        type: 'diff' | 'full';
      }
    ) => Promise<UploadLogsResponse>;
  };
}

/**
 * Interface representing the WebexSDK core functionality.
 * @interface WebexSDK
 * @public
 * @example
 * const sdk: WebexSDK = ...;
 * sdk.request({ service: 'identity', resource: '/users', method: HTTP_METHODS.GET });
 * @ignore
 */
export interface WebexSDK {
  /** Version of the WebexSDK */
  version: string;
  /** Whether the SDK can authorize requests */
  canAuthorize: boolean;
  /** Credentials management */
  credentials: {
    /** Get the user token for authentication */
    getUserToken: () => Promise<string>;
    /** Get the organization ID */
    getOrgId: () => string;
  };
  /** Whether the SDK is ready for use */
  ready: boolean;
  /** Make a request to the Webex APIs */
  request: <T>(payload: WebexRequestPayload) => Promise<T>;
  /** Register a one-time event handler */
  once: (event: string, callBack: () => void) => void;
  /** Internal plugins and services */
  internal: IWebexInternal;
  /** Logger instance */
  logger: Logger;
}

/**
 * An interface for the `ContactCenter` class.
 * The `ContactCenter` package is designed to provide a set of APIs to perform various operations for the Agent flow within Webex Contact Center.
 * @public
 * @example
 * const cc: IContactCenter = ...;
 * cc.register().then(profile => { ... });
 * @ignore
 */
export interface IContactCenter {
  /**
   * Initialize the CC SDK by setting up the contact center mercury connection.
   * This establishes WebSocket connectivity for real-time communication.
   *
   * @returns A Promise that resolves to the agent's profile upon successful registration
   * @public
   * @example
   * cc.register().then(profile => { ... });
   */
  register(): Promise<Profile>;
}

/**
 * Generic HTTP response structure.
 * @public
 * @example
 * const response: IHttpResponse = { body: {}, statusCode: 200, method: 'GET', headers: {}, url: '...' };
 * @ignore
 */
export interface IHttpResponse {
  /** Response body content */
  body: any;
  /** HTTP status code */
  statusCode: number;
  /** HTTP method used for the request */
  method: string;
  /** Response headers */
  headers: Headers;
  /** Request URL */
  url: string;
}

/**
 * Supported login options for agent authentication.
 * @public
 * @example
 * const option: LoginOption = LoginOption.AGENT_DN;
 * @ignore
 */
export const LoginOption = {
  /** Login using agent's direct number */
  AGENT_DN: 'AGENT_DN',
  /** Login using an extension number */
  EXTENSION: 'EXTENSION',
  /** Login using browser WebRTC capabilities */
  BROWSER: 'BROWSER',
} as const;

/**
 * Union type of login options.
 * @public
 * @example
 * function login(option: LoginOption) { ... }
 * @ignore
 */
export type LoginOption = Enum<typeof LoginOption>;

/**
 * Request payload for subscribing to the contact center websocket.
 * @public
 * @example
 * const req: SubscribeRequest = { force: true, isKeepAliveEnabled: true, clientType: 'browser', allowMultiLogin: false };
 * @ignore
 */
export type SubscribeRequest = {
  /** Whether to force connection even if another exists */
  force: boolean;
  /** Whether to send keepalive messages */
  isKeepAliveEnabled: boolean;
  /** Type of client connecting */
  clientType: string;
  /** Whether to allow login from multiple devices */
  allowMultiLogin: boolean;
};

/**
 * Represents the response from getListOfTeams method.
 * Teams are groups of agents that can be managed together.
 * @public
 * @example
 * const team: Team = { id: 'team1', name: 'Support', desktopLayoutId: 'layout1' };
 * @ignore
 */
export type Team = {
  /**
   * Unique identifier of the team.
   */
  id: string;

  /**
   * Display name of the team.
   */
  name: string;

  /**
   * Associated desktop layout ID for the team.
   * Controls how the agent desktop is displayed for team members.
   */
  desktopLayoutId?: string;
};

/**
 * Represents the request to perform agent login.
 * @public
 * @example
 * const login: AgentLogin = { dialNumber: '1234', teamId: 'team1', loginOption: LoginOption.AGENT_DN };
 */
export type AgentLogin = {
  /**
   * A dialNumber field contains the number to dial such as a route point or extension.
   * Required for AGENT_DN and EXTENSION login options.
   */
  dialNumber?: string;

  /**
   * The unique ID representing a team of users.
   * The agent must belong to this team.
   */
  teamId: string;

  /**
   * The loginOption field specifies the type of login method.
   * Controls how calls are delivered to the agent.
   */
  loginOption: LoginOption;
};

/**
 * Represents the request to update agent profile settings.
 * @public
 * @example
 * const update: AgentProfileUpdate = { loginOption: LoginOption.BROWSER, dialNumber: '5678' };
 */
export type AgentProfileUpdate = Pick<AgentLogin, 'loginOption' | 'dialNumber' | 'teamId'>;

/**
 * Union type for all possible request body types.
 * @internal
 * @ignore
 */
export type RequestBody =
  | SubscribeRequest
  | Agent.Logout
  | Agent.UserStationLogin
  | Agent.StateChange
  | Agent.BuddyAgents
  | Contact.HoldResumePayload
  | Contact.ResumeRecordingPayload
  | Contact.ConsultPayload
  | Contact.ConsultEndAPIPayload // API Payload accepts only QueueId wheres SDK API allows more params
  | Contact.TransferPayLoad
  | Contact.ConsultTransferPayLoad
  | Contact.cancelCtq
  | Contact.WrapupPayLoad
  | Contact.DialerPayload;

/**
 * Represents the options to fetch buddy agents for the logged in agent.
 * Buddy agents are other agents who can be consulted or transfered to.
 * @public
 * @example
 * const opts: BuddyAgents = { mediaType: 'telephony', state: 'Available' };
 * @ignore
 */
export type BuddyAgents = {
  /**
   * The media type channel to filter buddy agents.
   * Determines which channel capability the returned agents must have.
   */
  mediaType: 'telephony' | 'chat' | 'social' | 'email';

  /**
   * Optional filter for agent state.
   * If specified, returns only agents in that state.
   * If omitted, returns both available and idle agents.
   */
  state?: 'Available' | 'Idle';
};

/**
 * Generic error structure for Contact Center SDK errors.
 * Contains detailed information about the error context.
 * @public
 * @example
 * const err: GenericError = new Error('Failed');
 * err.details = { type: 'ERR', orgId: 'org1', trackingId: 'track1', data: {} };
 * @ignore
 */
export interface GenericError extends Error {
  /** Structured details about the error */
  details: {
    /** Error type identifier */
    type: string;
    /** Organization ID where the error occurred */
    orgId: string;
    /** Unique tracking ID for the error */
    trackingId: string;
    /** Additional error context data */
    data: Record<string, any>;
  };
}

/**
 * Response type for station login operations.
 * Either a success response with agent details or an error.
 * @public
 * @example
 * function handleLogin(resp: StationLoginResponse) { ... }
 */
export type StationLoginResponse = Agent.StationLoginSuccessResponse | Error;

/**
 * Response type for station logout operations.
 * Either a success response with logout details or an error.
 * @public
 * @example
 * function handleLogout(resp: StationLogoutResponse) { ... }
 */
export type StationLogoutResponse = Agent.LogoutSuccess | Error;

/**
 * Response type for station relogin operations.
 * Either a success response with relogin details or an error.
 * @public
 * @example
 * function handleReLogin(resp: StationReLoginResponse) { ... }
 * @ignore
 */
export type StationReLoginResponse = Agent.ReloginSuccess | Error;

/**
 * Response type for agent state change operations.
 * Either a success response with state change details or an error.
 * @public
 * @example
 * function handleStateChange(resp: SetStateResponse) { ... }
 * @ignore
 */
export type SetStateResponse = Agent.StateChangeSuccess | Error;

/**
 * AddressBook types
 */
export interface AddressBookEntry {
  id: string;
  organizationId?: string;
  version?: number;
  name: string;
  number: string;
  createdTime?: number;
  lastUpdatedTime?: number;
}

export type AddressBookEntriesResponse = PaginatedResponse<AddressBookEntry>;

export interface AddressBookEntrySearchParams extends BaseSearchParams {
  addressBookId?: string;
}

/**
 * EntryPointRecord types
 */
export interface EntryPointRecord {
  id: string;
  name: string;
  description?: string;
  type: string;
  isActive: boolean;
  orgId: string;
  createdAt?: string;
  updatedAt?: string;
  settings?: Record<string, any>;
}

export type EntryPointListResponse = PaginatedResponse<EntryPointRecord>;
export type EntryPointSearchParams = BaseSearchParams;

/**
 * Queue types
 */
export interface QueueSkillRequirement {
  organizationId?: string;
  id?: string;
  version?: number;
  skillId: string;
  skillName?: string;
  skillType?: string;
  condition: string;
  skillValue: string;
  createdTime?: number;
  lastUpdatedTime?: number;
}

export interface QueueAgent {
  id: string;
  ciUserId?: string;
}

export interface AgentGroup {
  teamId: string;
}

export interface CallDistributionGroup {
  agentGroups: AgentGroup[];
  order: number;
  duration?: number;
}

export interface AssistantSkillMapping {
  assistantSkillId?: string;
  assistantSkillUpdatedTime?: number;
}

/**
 * Configuration for a contact service queue
 * @public
 */
export interface ContactServiceQueue {
  /** Organization ID */
  organizationId?: string;
  /** Unique identifier for the queue */
  id?: string;
  /** Version of the queue */
  version?: number;
  /** Name of the Contact Service Queue */
  name: string;
  /** Description of the queue */
  description?: string;
  /** Queue type (INBOUND, OUTBOUND) */
  queueType: 'INBOUND' | 'OUTBOUND';
  /** Whether to check agent availability */
  checkAgentAvailability: boolean;
  /** Channel type (TELEPHONY, EMAIL, SOCIAL_CHANNEL, CHAT, etc.) */
  channelType: 'TELEPHONY' | 'EMAIL' | 'FAX' | 'CHAT' | 'VIDEO' | 'OTHERS' | 'SOCIAL_CHANNEL';
  /** Social channel type for SOCIAL_CHANNEL channelType */
  socialChannelType?:
    | 'MESSAGEBIRD'
    | 'MESSENGER'
    | 'WHATSAPP'
    | 'APPLE_BUSINESS_CHAT'
    | 'GOOGLE_BUSINESS_MESSAGES';
  /** Service level threshold in seconds */
  serviceLevelThreshold: number;
  /** Maximum number of simultaneous contacts */
  maxActiveContacts: number;
  /** Maximum time in queue in seconds */
  maxTimeInQueue: number;
  /** Default music in queue media file ID */
  defaultMusicInQueueMediaFileId: string;
  /** Timezone for routing strategies */
  timezone?: string;
  /** Whether the queue is active */
  active: boolean;
  /** Whether outdial campaign is enabled */
  outdialCampaignEnabled?: boolean;
  /** Whether monitoring is permitted */
  monitoringPermitted: boolean;
  /** Whether parking is permitted */
  parkingPermitted: boolean;
  /** Whether recording is permitted */
  recordingPermitted: boolean;
  /** Whether recording all calls is permitted */
  recordingAllCallsPermitted: boolean;
  /** Whether pausing recording is permitted */
  pauseRecordingPermitted: boolean;
  /** Recording pause duration in seconds */
  recordingPauseDuration?: number;
  /** Control flow script URL */
  controlFlowScriptUrl: string;
  /** IVR requeue URL */
  ivrRequeueUrl: string;
  /** Overflow number for telephony */
  overflowNumber?: string;
  /** Vendor ID */
  vendorId?: string;
  /** Routing type */
  routingType: 'LONGEST_AVAILABLE_AGENT' | 'SKILLS_BASED' | 'CIRCULAR' | 'LINEAR';
  /** Skills-based routing type */
  skillBasedRoutingType?: 'LONGEST_AVAILABLE_AGENT' | 'BEST_AVAILABLE_AGENT';
  /** Queue routing type */
  queueRoutingType: 'TEAM_BASED' | 'SKILL_BASED' | 'AGENT_BASED';
  /** Queue skill requirements */
  queueSkillRequirements?: QueueSkillRequirement[];
  /** List of agents for agent-based queue */
  agents?: QueueAgent[];
  /** Call distribution groups */
  callDistributionGroups: CallDistributionGroup[];
  /** XSP version */
  xspVersion?: string;
  /** Subscription ID */
  subscriptionId?: string;
  /** Assistant skill mapping */
  assistantSkill?: AssistantSkillMapping;
  /** Whether this is a system default queue */
  systemDefault?: boolean;
  /** User who last updated agents list */
  agentsLastUpdatedByUserName?: string;
  /** Email of user who last updated agents list */
  agentsLastUpdatedByUserEmailPrefix?: string;
  /** When agents list was last updated */
  agentsLastUpdatedTime?: number;
  /** Creation timestamp in epoch millis */
  createdTime?: number;
  /** Last updated timestamp in epoch millis */
  lastUpdatedTime?: number;
}

export type ContactServiceQueuesResponse = PaginatedResponse<ContactServiceQueue>;

export interface ContactServiceQueueSearchParams extends BaseSearchParams {
  desktopProfileFilter?: boolean;
  provisioningView?: boolean;
  singleObjectResponse?: boolean;
}

/**
 * Response type for buddy agents query operations.
 * Either a success response with list of buddy agents or an error.
 * @public
 * @example
 * function handleBuddyAgents(resp: BuddyAgentsResponse) { ... }
 */
export type BuddyAgentsResponse = Agent.BuddyAgentsSuccess | Error;

/**
 * Response type for device type update operations.
 * Either a success response with update confirmation or an error.
 * @public
 * @example
 * function handleUpdateDeviceType(resp: UpdateDeviceTypeResponse) { ... }
 */
export type UpdateDeviceTypeResponse = Agent.DeviceTypeUpdateSuccess | Error;
