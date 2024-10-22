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

type WebexRequestPayload = {
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
}

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
      get(name: string, priorityHost?: boolean, serviceGroup?: string): string;
    };
    metrics: {
      submitClientMetrics: (name: string, data: unknown) => void;
    };
  };
  // public plugins
  logger: {
    log: (payload: string) => void;
    error: (payload: string) => void;
    warn: (payload: string) => void;
    info: (payload: string) => void;
    trace: (payload: string) => void;
    debug: (payload: string) => void;
  };
}

/**
 * An interface for the `ContactCenter` class.
 * The `ContactCenter` package is designed to provide a set of APIs to perform various operations for the Agent flow within Webex Contact Center.
 */
export interface IContactCenter {
  /**
   * @ignore
   */
  $config: CCPluginConfig;
  /**
   * @ignore
   */
  $webex: WebexSDK;
  /**
   * WCC API Gateway Url
   */
  wccApiUrl: string;
  /**
   * This will be public API used for making the CC SDK ready by setting up the cc mercury connection.
   * @param success
   */
  register(): Promise<string>;
}

// Define the CC_EVENTS object
export const CC_EVENTS = {
  WELCOME: 'Welcome',
} as const;

// Derive the type using the utility type
export type CC_EVENTS = Enum<typeof CC_EVENTS>;

export interface WebSocketEvent {
  type: CC_EVENTS;
  data: {
    agentId: string;
  };
}

export interface SubscribeRequest {
  force: boolean;
  isKeepAliveEnabled: boolean;
  clientType: string;
  allowMultiLogin: boolean;
}

export type EventResult = string; // TODO: Will send AgentPRofile object as part of Parv's PR and new types add as and when required
