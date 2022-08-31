export interface LookupDetailOptions {
  id: string;
}

export interface LookupOptions {
  ids: string[];
}

export interface LookupByEmailOptions {
  emails: string[];
}

export enum SearchType {
  PERSON = 'PERSON', 
  CALLING_SERVICE = 'CALLING_SERVICE',
  EXTERNAL_CALLING = 'EXTERNAL_CALLING',
  ROOM = 'ROOM',
  ROBOT = 'ROBOT'
}

export interface SearchOptions {
  requestedTypes: SearchType[],
  resultSize: number,
  queryString: string,
}
