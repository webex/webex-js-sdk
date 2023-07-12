export interface RequestOptions {
  resource: string;
  dataPath: string;
  foundPath?: string;
  notFoundPath?: string;
  params?: Record<string, unknown>;
  timeout?: number;
}

export interface RequestResult {
  foundArray?: any[];
  notFoundArray?: any[];
  resultArray: any[];
}

export interface LookupDetailOptions extends Pick<RequestOptions, 'timeout'> {
  id: string;
}

export enum EntityProviderType {
  CI_USER = 'CI_USER',
  CI_MACHINE = 'CI_MACHINE',
  CONTACTS = 'CONTACTS',
  CSDM = 'CSDM',
}

export interface LookupOptions extends Pick<RequestOptions, 'timeout'> {
  id: string;
  entityProviderType?: EntityProviderType;
  shouldBatch?: boolean;
}

export interface LookupByEmailOptions extends Pick<RequestOptions, 'timeout'> {
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

export interface SearchOptions extends Pick<RequestOptions, 'timeout'> {
  requestedTypes: SearchType[];
  resultSize: number;
  queryString: string;
}

export interface BatcherOptions extends Pick<RequestOptions, 'timeout'> {
  resource: string;
  lookupValue: string;
}
