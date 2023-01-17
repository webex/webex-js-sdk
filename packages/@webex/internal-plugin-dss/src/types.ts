export interface LookupDetailOptions {
  id: string;
}

// eslint-disable-next-line no-shadow
export enum EntityProviderType {
  CI_USER = 'CI_USER',
  CI_MACHINE = 'CI_MACHINE',
  CONTACTS = 'CONTACTS',
  CSDM = 'CSDM',
}

export interface LookupOptions {
  ids: string[];
  entityProviderType?: EntityProviderType;
}

export interface LookupByEmailOptions {
  emails: string[];
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
