import type {Page} from '@playwright/test';

export type CallHistoryQuery = {
  days?: number;
  limit?: number;
  sort?: 'ASC' | 'DESC';
  sortBy?: 'startTime' | 'endTime';
};

export type CallHistoryWaitOptions = CallHistoryQuery & {
  timeout?: number;
};

export type HistoryTimeBounds = {
  notBefore?: Date;
  notAfter?: Date;
};

export type CallHistoryRecord = {
  sessionId?: string;
  direction?: string;
  disposition?: string;
  startTime?: string;
  endTime?: string;
  durationSeconds?: number;
  durationSecs?: number;
  sessionType?: string;
  other?: {
    name?: string;
    callbackAddress?: string;
    phoneNumber?: string;
    primaryDisplayString?: string;
    secondaryDisplayString?: string;
  };
  links?: {
    callbackAddress?: string;
  };
};

export type CallHistoryRow = {
  id: string;
  name: string;
  direction: string;
  disposition: string;
  startTime: string;
  endTime: string;
  sessionType: string;
  callbackAddress: string;
  redirectionReason: string;
  forwardedBy: string;
};

export type HistoryMatcherOptions = {
  counterpartNumber: string;
  direction: 'INCOMING' | 'OUTGOING';
  startedAt: Date;
  dispositions?: string[];
};

export type HistoryDebugRecord = {
  user: string;
  expectedDisposition: 'ANSWERED' | 'REJECTED' | 'MISSED' | 'CANCELED';
  record: CallHistoryRecord;
};

export type CallJourneyLeg = {
  label: string;
  originLabel: string;
  originPage: Page;
  originNumber: string;
  targetLabel: string;
  targetPage: Page;
  targetNumber: string;
  outcome: 'ANSWERED' | 'REJECTED' | 'MISSED';
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
