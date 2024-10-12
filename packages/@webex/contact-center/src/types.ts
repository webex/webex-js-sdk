export enum HTTP_METHODS {
  GET = 'GET',
  POST = 'POST',
  PATCH = 'PATCH',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

export type WebexRequestPayload = {
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

export type ServiceHost = {
  host: string;
  ttl: number;
  priority: number;
  id: string;
  homeCluster?: boolean;
};

export interface CCConfig {
  cc: {
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
  };
}

export interface WebexSDK {
  version: string;
  canAuthorize: boolean;
  credentials: {
    getUserToken: () => Promise<string>;
    getOrgId: () => Promise<string>;
  };
  ready: boolean;
  request: <T>(payload: WebexRequestPayload) => Promise<T>;
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

export interface IContactCenter {
  $config: CCConfig;
  $webex: WebexSDK;
  wccAPIURL: string;
  register(success: boolean): Promise<string>;
}
