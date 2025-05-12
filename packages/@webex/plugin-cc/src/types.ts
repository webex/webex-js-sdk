import {CallingClientConfig} from '@webex/calling';
import {
  SubmitBehavioralEvent,
  SubmitOperationalEvent,
  SubmitBusinessEvent,
} from '@webex/internal-plugin-metrics/src/metrics.types';
import * as Agent from './services/agent/types';
import * as Contact from './services/task/types';
import {Profile} from './services/config/types';

type Enum<T extends Record<string, unknown>> = T[keyof T];

// Define the HTTP_METHODS object
export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PATCH: 'PATCH',
  PUT: 'PUT',
  DELETE: 'DELETE',
} as const;

// Derive the type using the utility type
export type HTTP_METHODS = Enum<typeof HTTP_METHODS>;

export type WebexRequestPayload = {
  service?: string;
  resource?: string;
  method?: HTTP_METHODS;
  uri?: string;
  addAuthHeader?: boolean;
  headers?: {
    [key: string]: string | null;
  };
  body?: object;
  statusCode?: number;
  json?: boolean;
};

type Listener = (e: string, data?: unknown) => void;
type ListenerOff = (e: string) => void;

type ServiceHost = {
  host: string;
  ttl: number;
  priority: number;
  id: string;
  homeCluster?: boolean;
};

export interface CCPluginConfig {
  allowMultiLogin: boolean;
  allowAutomatedRelogin: boolean;
  clientType: string;
  isKeepAliveEnabled: boolean;
  force: boolean;
  metrics: {
    clientName: string;
    clientType: string;
  };
  logging: {
    enable: boolean;
    verboseEvents: boolean;
  };
  callingClientConfig: CallingClientConfig;
}

/**
 * Logging related types
 */
export type Logger = {
  log: (payload: string) => void;
  error: (payload: string) => void;
  warn: (payload: string) => void;
  info: (payload: string) => void;
  trace: (payload: string) => void;
  debug: (payload: string) => void;
};

export interface LogContext {
  module?: string;
  method?: string;
}

export enum LOGGING_LEVEL {
  error = 'ERROR',
  warn = 'WARN',
  log = 'LOG',
  info = 'INFO',
  trace = 'TRACE',
}

export type LogsMetaData = {
  feedbackId?: string;
  correlationId?: string;
};

export type UploadLogsResponse = {
  trackingid?: string;
  url?: string;
  userId?: string;
  feedbackId?: string;
  correlationId?: string;
};
interface IWebexInternal {
  mercury: {
    on: Listener;
    off: ListenerOff;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    connected: boolean;
    connecting: boolean;
  };
  device: {
    url: string;
    userId: string;
    orgId: string;
    version: string;
    callingBehavior: string;
  };
  presence: unknown;
  services: {
    get: (service: string) => string;
    waitForCatalog: (service: string) => Promise<void>;
    _hostCatalog: Record<string, ServiceHost[]>;
    _serviceUrls: {
      mobius: string;
      identity: string;
      janus: string;
      wdm: string;
      broadworksIdpProxy: string;
      hydra: string;
      mercuryApi: string;
      'ucmgmt-gateway': string;
      contactsService: string;
    };
  };
  newMetrics: {
    submitBehavioralEvent: SubmitBehavioralEvent;
    submitOperationalEvent: SubmitOperationalEvent;
    submitBusinessEvent: SubmitBusinessEvent;
  };
  support: {
    submitLogs: (
      metaData: LogsMetaData,
      logs: string,
      options: {
        type: 'diff' | 'full';
      }
    ) => Promise<UploadLogsResponse>;
  };
}
export interface WebexSDK {
  version: string;
  canAuthorize: boolean;
  credentials: {
    getUserToken: () => Promise<string>;
    getOrgId: () => string;
  };
  ready: boolean;
  request: <T>(payload: WebexRequestPayload) => Promise<T>;
  once: (event: string, callBack: () => void) => void;
  // internal plugins
  internal: IWebexInternal;
  // public plugins
  logger: Logger;
}

/**
 * An interface for the `ContactCenter` class.
 * The `ContactCenter` package is designed to provide a set of APIs to perform various operations for the Agent flow within Webex Contact Center.
 */
export interface IContactCenter {
  /**
   * This will be public API used for making the CC SDK ready by setting up the cc mercury connection.
   */
  register(): Promise<Profile>;
}

export interface IHttpResponse {
  body: any;
  statusCode: number;
  method: string;
  headers: Headers;
  url: string;
}

export const LoginOption = {
  AGENT_DN: 'AGENT_DN',
  EXTENSION: 'EXTENSION',
  BROWSER: 'BROWSER',
} as const;

// Derive the type using the utility type
export type LoginOption = Enum<typeof LoginOption>;

export type SubscribeRequest = {
  force: boolean;
  isKeepAliveEnabled: boolean;
  clientType: string;
  allowMultiLogin: boolean;
};

/**
 * Represents the response from getListOfTeams method.
 *
 * @public
 */
export type Team = {
  /**
   * ID of the team.
   */
  id: string;

  /**
   *  Name of the Team.
   */
  name: string;

  /**
   *  desktopLayoutId of the Team.
   */
  desktopLayoutId?: string;
};

/**
 * Represents the request to a AgentLogin
 *
 * @public
 */
export type AgentLogin = {
  /**
   * A dialNumber field contains the number to dial such as a route point or extension.
   */

  dialNumber?: string;

  /**
   * The unique ID representing a team of users.
   */

  teamId: string;

  /**
   * The loginOption field contains the type of login.
   */

  loginOption: LoginOption;
};
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
 * @public
 */
export type BuddyAgents = {
  /**
   * The media type for the request. The supported values are telephony, chat, social and email.
   */
  mediaType: 'telephony' | 'chat' | 'social' | 'email';
  /**
   * It represents the current state of the returned agents which can be either Available or Idle.
   * If state is omitted, the API will return a list of both available and idle agents.
   * This is useful for consult scenarios, since consulting an idle agent is also supported.
   */
  state?: 'Available' | 'Idle';
};

export type StationLoginResponse = Agent.StationLoginSuccessResponse | Error;
export type StationLogoutResponse = Agent.LogoutSuccess | Error;
export type StationReLoginResponse = Agent.ReloginSuccess | Error;
export type SetStateResponse = Agent.StateChangeSuccess | Error;
export type BuddyAgentsResponse = Agent.BuddyAgentsSuccess | Error;
