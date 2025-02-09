import {KmsKey, KmsResourceObject, PeopleListResponse, WebexRequestPayload} from '../common/types';
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

// TODO: is there a way to import bindings from the Webex JS SDK without having to redefine expected methods and structure?
// This defines the shape for the webex SDK, if a typing doesn't exist, it should be added here
export interface WebexSDK {
  // top level primitives/funcs
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
    support: unknown;
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
      fetchClientRegionInfo: () => Promise<ClientRegionInfo>;
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
