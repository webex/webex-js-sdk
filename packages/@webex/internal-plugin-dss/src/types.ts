export interface RequestOptions {
  resource: string;
  dataPath: string;
  foundPath?: string;
  notFoundPath?: string;
  params?: Record<string, unknown>;
}

export interface RequestResult {
  foundArray?: any[];
  notFoundArray?: any[];
  resultArray: any[];
}

export interface LookupDetailOptions {
  id: string;
}

export enum EntityProviderType {
  CI_USER = 'CI_USER',
  CI_MACHINE = 'CI_MACHINE',
  CONTACTS = 'CONTACTS',
  CSDM = 'CSDM',
}

export interface LookupOptions {
  id: string;
  entityProviderType?: EntityProviderType;
  shouldBatch?: boolean;
}

export interface LookupByEmailOptions {
  email: string;
}

// eslint-disable-next-line no-shadow
export enum SearchType {
  PERSON = 'PERSON',
  CALLING_SERVICE = 'CALLING_SERVICE',
  EXTERNAL_CALLING = 'EXTERNAL_CALLING',
  ROOM = 'ROOM',
  ROBOT = 'ROBOT',
}

export interface SearchOptions {
  requestedTypes: SearchType[];
  resultSize: number;
  queryString: string;
}

export interface BatcherOptions {
  resource: string;
  lookupValue: string;
}

export interface SearchPlaceOptions {
  resultSize: number;
  queryString: string;
  isOnlySchedulableRooms: boolean;
}
