import type {Page} from '@playwright/test';

export type SortOrder = 'ASC' | 'DESC';
export type SortBy = 'startTime' | 'endTime';

export type CallHistoryQuery = {
  days?: number;
  limit?: number;
  sort?: SortOrder;
  sortBy?: SortBy;
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
