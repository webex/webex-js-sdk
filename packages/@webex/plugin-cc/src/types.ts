import {CallingClientConfig} from '@webex/calling';
import * as Agent from './services/agent/types';

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

export type Logger = {
  log: (payload: string) => void;
  error: (payload: string) => void;
  warn: (payload: string) => void;
  info: (payload: string) => void;
  trace: (payload: string) => void;
  debug: (payload: string) => void;
};

export interface WebexSDK {
  version: string;
  canAuthorize: boolean;
  credentials: {
    getUserToken: () => Promise<string>;
  };
  ready: boolean;
  request: <T>(payload: WebexRequestPayload) => Promise<T>;
  once: (event: string, callBack: () => void) => void;
  // internal plugins
  internal: {
    mercury: {
      on: Listener;
      off: ListenerOff;
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
    metrics: {
      submitClientMetrics: (name: string, data: unknown) => void;
    };
  };
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
  register(): Promise<IAgentProfile>;
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

export type WelcomeEvent = {
  agentId: string;
};

export type WelcomeResponse = WelcomeEvent | Error;

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
};

/**
 * Represents AuxCode.
 * @public
 */

export type AuxCode = {
  /**
   * ID of the Auxiliary Code.
   */
  id: string;

  /**
   * Indicates whether the auxiliary code is active or not active.
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
   * Name for the Auxiliary Code.
   */
  name: string;

  /**
   * Indicates the work type associated with this code..
   */

  workTypeCode: string;
};

/**
 * Represents the response from AgentConfig.
 *
 * @public
 */
export type IAgentProfile = {
  /**
   * The id of the agent.
   */

  agentId: string;

  /**
   * The name of the agent.
   */
  agentName: string;

  /**
   * Identifier for a Desktop Profile.
   */
  agentProfileId: string;

  /**
   * The email address of the agent.
   */

  agentMailId: string;

  /**
   * Represents list of teams of an agent.
   */
  teams: Team[];

  /**
   * Represents the voice options of an agent.
   */

  loginVoiceOptions: string[];

  /**
   * Represents the Idle codes list that the agents can select in Agent Desktop.t.
   */

  idleCodes: AuxCode[];

  /**
   * Represents the wrap-up codes list that the agents can select when they wrap up a contact.
   */
  wrapUpCodes: AuxCode[];
};

export type EventResult = IAgentProfile;

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
  | Agent.BuddyAgents;

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

export type StationLoginResponse = Agent.StationLoginSuccess | Error;
export type StationLogoutResponse = Agent.LogoutSuccess | Error;
export type StationReLoginResponse = Agent.ReloginSuccess | Error;
export type BuddyAgentsResponse = Agent.BuddyAgentsSuccess | Error;
