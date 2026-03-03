import {FailoverCacheState} from 'CallingClient/registration/types';
import {
  KmsKey,
  KmsResourceObject,
  LogsMetaData,
  PeopleListResponse,
  UploadLogsResponse,
  WebexRequestPayload,
} from '../common/types';
/* eslint-disable no-shadow */

type Listener = (e: string, data?: unknown) => void;
type ListenerOff = (e: string) => void;

export type ServiceHost = {
  host: string;
  ttl: number;
  priority: number;
  id: string;
  homeCluster?: boolean;
};

export type Model = {
  _values: {
    key: string;
  };
};

export type ServiceCatalog = {
  serviceGroups: {
    // cSpell:disable
    postauth: [
      {
        _values: {
          name: string;
          hosts: ServiceHost[];
        };
      }
    ];
    /* cSpell:enable */
  };
};

export type ClientRegionInfo = {
  attribution: string;
  clientAddress: string;
  clientRegion: string;
  countryCode: string;
  disclaimer: string;
  regionCode: string;
  timezone: string;
};

export type Logger = {
  config?: {
    level: string;
    bufferLogLevel: string;
  };
  log: (payload: string) => void;
  error: (payload: string) => void;
  warn: (payload: string) => void;
  info: (payload: string) => void;
  trace: (payload: string) => void;
  debug: (payload: string) => void;
};

// TODO: is there a way to import bindings from the Webex JS SDK without having to redefine expected methods and structure?
// This defines the shape for the webex SDK, if a typing doesn't exist, it should be added here
export interface WebexSDK {
  boundedStorage: {
    get: (namespace: string, key: string) => Promise<FailoverCacheState>;
    put: (namespace: string, key: string, value: FailoverCacheState) => Promise<void>;
    del: (namespace: string, key: string) => Promise<void>;
  };
  // top level primitives/funcs
  config: {fedramp: boolean};
  version: string;
  canAuthorize: boolean;
  credentials: {
    getUserToken: () => Promise<string>;
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
    calendar: unknown;
    device: {
      url: string;
      userId: string;
      orgId: string;
      version: string;
      callingBehavior: string;
      features: {
        entitlement: {
          models: Model[];
        };
      };
    };
    encryption: {
      decryptText: (encryptionKeyUrl: string, encryptedData?: string) => Promise<string>;
      encryptText: (encryptionKeyUrl: string, text?: string) => Promise<string>;
      kms: {
        createUnboundKeys: (arg0: {count?: number}) => Promise<KmsKey[]>;
        createResource: (arg0: {keyUris: string[]}) => Promise<KmsResourceObject>;
        bindKey: (arg0: {kroUri: string; keyUri: string}) => Promise<KmsKey>;
      };
    };
    presence: unknown;
    support: {
      submitLogs: (
        metaData: LogsMetaData,
        logs?: string,
        options?: {
          type: 'diff' | 'full';
        }
      ) => Promise<UploadLogsResponse>;
    };
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
      _activeServices: {
        broadworksIdpProxy: string;
        contactsService: string;
        hydra: string;
        janus: string;
        mercuryApi: string;
        mobius: string;
      };
      get: (service: string) => string;
      getMobiusClusters: () => ServiceHost[];
      fetchClientRegionInfo: () => Promise<ClientRegionInfo>;
    };
    metrics: {
      submitClientMetrics: (name: string, data: unknown) => void;
    };
  };
  // public plugins
  logger: Logger;
  messages: unknown;
  memberships: unknown;
  people: {
    list: (arg: object) => Promise<PeopleListResponse>;
  };
  rooms: unknown;
  teams: unknown;
}

export interface ISDKConnector {
  setWebex: (webexInstance: WebexSDK) => void;
  getWebex: () => WebexSDK;
  get: () => ISDKConnector;
  registerListener: <T>(event: string, cb: (data?: T) => unknown) => void;
  unregisterListener: (event: string) => void;
}
