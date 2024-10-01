import {SCIM_ENTERPRISE_USER, SCIM_WEBEXIDENTITY_USER} from './constants';

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
export enum CallType {
  URI = 'uri',
  TEL = 'tel',
}
export type CallDetails = {
  type: CallType;
  address: string; // sip address
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

export interface URIAddress {
  value: string;
  type: string;
  primary?: boolean;
}

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

export interface Name {
  familyName: string;
  givenName: string;
}

export interface Address {
  city?: string;
  country?: string;
  state?: string;
  street?: string;
  zipCode?: string;
}

interface WebexIdentityMeta {
  organizationId: string;
}
interface WebexIdentityUser {
  sipAddresses?: URIAddress[];
  meta?: WebexIdentityMeta;
}

interface Manager {
  value: string;
  displayName: string;
  $ref: string;
}

interface EnterpriseUser {
  department?: string;
  manager?: Manager;
}

interface Resource {
  schemas: string[];
  id: string;
  userName: string;
  active?: boolean;
  name?: Name;
  displayName?: string;
  emails?: URIAddress[];
  userType: string;
  phoneNumbers?: PhoneNumber[];
  photos?: ContactDetail[];
  addresses?: Address[];
  [SCIM_WEBEXIDENTITY_USER]?: WebexIdentityUser;
  [SCIM_ENTERPRISE_USER]?: EnterpriseUser;
}

export interface SCIMListResponse {
  schemas: string[];
  totalResults: number;
  itemsPerPage: number;
  startIndex: number;
  Resources: Resource[];
}
