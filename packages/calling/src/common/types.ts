export type MobiusDeviceId = string;
export type MobiusDeviceUri = string;
export type SettingEnabled = boolean;

export enum ALLOWED_SERVICES {
  MOBIUS = 'mobius',
  JANUS = 'janus',
}
export enum HTTP_METHODS {
  GET = 'GET',
  POST = 'POST',
  PATCH = 'PATCH',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

export enum RegistrationStatus {
  IDLE = 'IDLE',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum CALLING_BACKEND {
  WXC = 'WEBEX_CALLING',
  BWRKS = 'BROADWORKS_CALLING',
  UCM = 'UCM_CALLING',
  INVALID = 'Calling backend is currently not supported',
}

export type DeviceList = unknown;
export type CallId = string; // guid;
export type CorrelationId = string;
export type SipAddress = string;
export enum CallType {
  URI = 'uri',
  TEL = 'tel',
}
export type CallDetails = {
  type: CallType;
  address: SipAddress; // sip address
};

export type CallDestination = CallDetails;
export enum CallDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}
export type AvatarId = string;
export type DisplayName = string;
export type DisplayInformation = {
  avatarSrc: AvatarId | undefined;
  name: DisplayName | undefined;
  num: string | undefined;
  id: string | undefined;
};

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
  service?: ALLOWED_SERVICES;
};

export type ErrorCode = string;

export type Digit = string | number;

export type ServerInfo = {
  region: string;
  uris: string[];
};

export type MobiusServers = {
  primary: ServerInfo;
  backup: ServerInfo;
};

export type IpInfo = {
  ipv4: string;
  ipv6: string;
};

export type DeviceType = {
  deviceId: string;
  uri: string;
  status: string;
  lastSeen: string;
  addresses: string[];
  clientDeviceUri: string;
};

export type RegionInfo = {
  countryCode: string;
  clientRegion: string;
};

export interface IDeviceInfo {
  userId?: string;
  errorCode?: number;

  device?: DeviceType;
  devices?: DeviceType[];
  keepaliveInterval?: number;
  callKeepaliveInterval?: number;
  voicePortalNumber?: number;
  voicePortalExtension?: number;
  // cSpell:disable
  rehomingIntervalMin?: number;
  rehomingIntervalMax?: number;
  /* cSpell:enable */
}

export interface IMetaContext {
  file?: string;
  method?: string;
}

export enum SORT {
  ASC = 'ASC',
  DESC = 'DESC',
  DEFAULT = 'DESC',
}

export enum SORT_BY {
  END_TIME = 'endTime',
  DEFAULT = 'endTime',
  START_TIME = 'startTime',
}

export enum ServiceIndicator {
  CALLING = 'calling',
  CONTACT_CENTER = 'contactcenter',
}

export type ServiceData = {
  indicator: ServiceIndicator;
  domain?: string;
};

export type PhoneNumber = {
  type: string;
  value: string;
  primary?: boolean;
};

export type PersonInfo = {
  id: string;
  emails: string[];
  phoneNumbers: PhoneNumber[];
  displayName: string;
  nickName: string;
  firstName: string;
  lastName: string;
  avatar: string;
  orgId: string;
  created: string;
  lastModified: string;
  lastActivity: string;
  status: string;
  type: string;
};

export type PeopleListResponse = {
  items: PersonInfo[];
  notFoundIds: string[];
};

export enum DecodeType {
  PEOPLE = 'PEOPLE',
  ORGANIZATION = 'ORGANIZATION',
}

export type ContactDetail = {
  type?: string;
  value: string;
};

export interface LookupOptions {
  id: string;
  shouldBatch: boolean;
}

export type DSSLookupResponse = {
  additionalInfo: {
    department: string;
    firstName: string;
    identityManager: {
      managerId: string;
      displayName: string;
    };
    jobTitle: string;
    lastName: string;
  };
  displayName: string;
  emails: ContactDetail[];
  entityProviderType: string;
  identity: string;
  orgId: string;
  phoneNumbers: ContactDetail[];
  photos: ContactDetail[];
  sipAddresses: ContactDetail[];
  type: string;
};

export type KmsKey = {
  uri: string;
  userId: string;
  createDate: string;
  expirationDate: string;
  bindDate?: string;
  resourceUri?: string;
};

export type KmsResourceObject = {
  uri: string;
  keyUris: string[];
  authorizationUris: string[];
};
