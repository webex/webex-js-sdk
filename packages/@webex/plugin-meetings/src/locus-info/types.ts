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

export type LocusDTO = {
  controls?: any;
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
  links?: any;
  mediaShares?: any[];
  meetings?: any[];
  participants: any[];
  replaces?: any[];
  self?: any;
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
