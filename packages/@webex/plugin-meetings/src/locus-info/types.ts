import {Enum} from '../constants';
import {HtMeta} from '../hashTree/types';

export const EndMeetingReason = {
  maxMeetingDuration: 'MAX_MEETING_DURATION',
  allParticipantsLeft: 'ALL_PARTICIPANTS_LEFT',
  sipHostLeft: 'SIP_HOST_LEFT',
  noHost: 'NO_HOST',
  waitingForMpsEndMeetingTimeout: 'WAITING_FOR_MPS_END_MEETING_TIMEOUT',
  fraudDetection: 'FRAUD_DETECTION',
  meetingEndedByHost: 'MEETING_ENDED_BY_HOST',
  meetingUpdated: 'MEETING_UPDATED', // Locus code has comment about EndMeetingIfPossible reason for this one
  meetingCancelled: 'MEETING_CANCELLED', // Locus code has comment about EndMeetingIfPossible reason for this one
  autoEndWithSingleParticipant: 'AUTO_END_WITH_SINGLE_PARTICIPANT',
  breakoutEnded: 'BREAKOUT_ENDED', // indicates that only a breakout session ended, not the whole meeting
} as const;

export type EndMeetingReason = Enum<typeof EndMeetingReason>;

export type LocusFullState = {
  active: boolean;
  count: number;
  lastActive: string;
  locked: boolean;
  sessionId: string;
  sessionIds: string[];
  startTime: number;
  state: string;
  type: string;
  endMeetingReason?: EndMeetingReason;
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
    forceReplaceMembers?: boolean; // when true, forces a full replacement of meeting members (e.g. when switching to a new hash tree parser - when moving between breakouts)
  };
  links?: Links;
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

export type ReplacesInfo = {
  locusUrl: string;
  replacedAt: string;
  sessionId: string;
};
