import type {Page} from '@playwright/test';
import type {CallHistoryRecord} from './call-history';

export type CallJourneyOutcome = 'ANSWERED' | 'REJECTED' | 'MISSED';
export type CallHistoryDisposition = CallJourneyOutcome | 'CANCELED';
export type UserLabel = 'user1' | 'user2';

export type HistoryMatcherOptions = {
  counterpartNumber: string;
  direction: 'INCOMING' | 'OUTGOING';
  startedAt: Date;
  dispositions?: string[];
};

export type HistoryDebugRecord = {
  user: UserLabel;
  expectedDisposition: CallHistoryDisposition;
  record: CallHistoryRecord;
};

export type CallJourneyLeg = {
  label: string;
  originLabel: UserLabel;
  originPage: Page;
  originNumber: string;
  targetLabel: UserLabel;
  targetPage: Page;
  targetNumber: string;
  outcome: CallJourneyOutcome;
  originSeenHistoryKeys: Set<string>;
  targetSeenHistoryKeys: Set<string>;
};

export type BidirectionalHistoryJourneyOptions = {
  user1Page: Page;
  user1Number: string;
  user2Page: Page;
  user2Number: string;
};

export type BidirectionalHistoryJourneyResult = {
  user1Records: CallHistoryRecord[];
  user2Records: CallHistoryRecord[];
  debugRecords: HistoryDebugRecord[];
};
