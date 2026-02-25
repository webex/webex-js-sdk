import {HtMeta} from '../hashTree/types';

export type LocusFullState = {
  active: boolean;
  count: number;
  lastActive: string;
  locked: boolean;
  sessionId: string;
  seessionIds: string[];
  startTime: number;
  state: string;
  type: string;
};

export type Links = {
  services: Record<'breakout' | 'record', {url: string}>; // there exist also other services, but these are the ones we currently use
  resources: Record<'webcastInstance' | 'visibleDataSets', {url: string}>; // there exist also other resources, but these are the ones we currently use
};

export type LocusDTO = {
  controls?: any;
  embeddedApps?: any[];
  fullState?: LocusFullState;
  host?: {
    id: string;
    incomingCallProtocols: any[];
    isExternal: boolean;
    name: string;
    orgId: string;
  };
  htMeta?: HtMeta;
  info?: any;
  jsSdkMeta?: {
    removedParticipantIds: string[]; // list of ids of participants that are removed in the last update
  };
  links?: Links;
  mediaShares?: any[];
  meetings?: any[];
  participants: any[];
  replaces?: any[];
  self?: {
    // this is not a complete type for self, but just a start (better than nothing), it will be updated once we manage to get this info out of the Locus team
    identity: string;
    url: string;
    state: string;
    type: string;
    id: string;
    guest: boolean;
    panelist: boolean;
    moderator: boolean;
    removed?: boolean;
    deviceUrl: string;
    controls: any;
    [key: string]: any;
  };
  sequence?: {
    dirtyParticipants: number;
    entries: number[];
    rangeEnd: number;
    rangeStart: number;
    sequenceHash: number;
    sessionToken: string;
    since: string;
    totalParticipants: number;
  };
  syncUrl?: string;
  url?: string;
};
