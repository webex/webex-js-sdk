import {
  Disposition,
  MOBIUS_EVENT_KEYS,
  CallSessionEvent,
  SessionType,
  CallSessionViewedEvent,
} from '../Events/types';
import {UCMLinesResponse, UpdateMissedCallsResponse} from './types';

export const sortedCallHistory = {
  body: {
    statusCode: 200,
    userSessions: [
      {
        id: 'd74d19cc-6aa7-f341-6012-aec433cc6f8d',
        durationSecs: 438,
        self: {
          id: 'a24027e7-9b6e-4047-a950-42f4492148ec',
          name: 'Mark',
          incomingCallProtocols: [],
          callbackInfo: {
            callbackAddress: 'test@cisco.com',
            callbackType: 'EMAIL',
          },
          lookUpInfo: {
            lookupLink:
              'https://conv-a.wbx2.com/conversation/api/v1/conversations/c9252ff0-9de2-11ec-a582-59d00c02cca9',
            type: 'CONVERSATION',
          },
        },
        url: 'https://janus-a.wbx2.com/janus/api/v1/history/userSessions/d74d19cc-6aa7-f341-6012-aec433cc6f8d',
        sessionId: 'd74d19cc-6aa7-f341-6012-aec433cc6f8d',
        sessionType: 'SPARK',
        startTime: '2022-08-09T10:45:21.565Z',
        endTime: '2022-08-09T10:53:01.624Z',
        direction: 'OUTGOING',
        disposition: 'INITIATED',
        other: {
          id: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
          name: 'test',
          isPrivate: false,
          callbackAddress: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
        },
        durationSeconds: 438,
        joinedDurationSeconds: 457,
        participantCount: 2,
        links: {
          locusUrl:
            'https://locus-a.wbx2.com/locus/api/v1/loci/f5dbe4da-663b-3f73-a2fc-3a2fb0f12080',
          conversationUrl:
            'https://conv-a.wbx2.com/conversation/api/v1/conversations/c9252ff0-9de2-11ec-a582-59d00c02cca9',
          callbackAddress: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
        },
        isDeleted: false,
        isPMR: false,
        correlationIds: ['58ea6cd9-852b-4a77-957f-e704c8b0e63e'],
      },
      {
        id: 'd74d19cc-6aa7-f341-6012-aec433cc6f8d',
        durationSecs: 438,
        self: {
          id: 'a24027e7-9b6e-4047-a950-42f4492148ec',
          name: 'Mark',
          incomingCallProtocols: [],
          callbackInfo: {
            callbackAddress: 'test@cisco.com',
            callbackType: 'EMAIL',
          },
          lookUpInfo: {
            lookupLink:
              'https://conv-a.wbx2.com/conversation/api/v1/conversations/c9252ff0-9de2-11ec-a582-59d00c02cca9',
            type: 'CONVERSATION',
          },
        },
        url: 'https://janus-a.wbx2.com/janus/api/v1/history/userSessions/d74d19cc-6aa7-f341-6012-aec433cc6f8d',
        sessionId: 'd74d19cc-6aa7-f341-6012-aec433cc6f8d',
        sessionType: 'SPARK',
        startTime: '2022-08-22T10:45:21.565Z',
        endTime: '2022-08-22T10:53:01.624Z',
        direction: 'OUTGOING',
        disposition: 'INITIATED',
        other: {
          id: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
          name: 'test',
          isPrivate: false,
          callbackAddress: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
        },
        durationSeconds: 438,
        joinedDurationSeconds: 457,
        participantCount: 2,
        links: {
          locusUrl:
            'https://locus-a.wbx2.com/locus/api/v1/loci/f5dbe4da-663b-3f73-a2fc-3a2fb0f12080',
          conversationUrl:
            'https://conv-a.wbx2.com/conversation/api/v1/conversations/c9252ff0-9de2-11ec-a582-59d00c02cca9',
          callbackAddress: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
        },
        isDeleted: false,
        isPMR: false,
        correlationIds: ['58ea6cd9-852b-4a77-957f-e704c8b0e63e'],
      },
      {
        id: 'd74d19cc-6aa7-f341-6012-aec433cc6f8d',
        durationSecs: 438,
        self: {
          id: 'a24027e7-9b6e-4047-a950-42f4492148ec',
          name: 'Mark',
          incomingCallProtocols: [],
          callbackInfo: {
            callbackAddress: 'test@cisco.com',
            callbackType: 'EMAIL',
          },
          lookUpInfo: {
            lookupLink:
              'https://conv-a.wbx2.com/conversation/api/v1/conversations/c9252ff0-9de2-11ec-a582-59d00c02cca9',
            type: 'CONVERSATION',
          },
        },
        url: 'https://janus-a.wbx2.com/janus/api/v1/history/userSessions/d74d19cc-6aa7-f341-6012-aec433cc6f8d',
        sessionId: 'd74d19cc-6aa7-f341-6012-aec433cc6f8d',
        sessionType: 'SPARK',
        startTime: '2022-08-30T10:45:21.565Z',
        endTime: '2022-08-30T10:53:01.624Z',
        direction: 'OUTGOING',
        disposition: 'INITIATED',
        other: {
          id: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
          name: 'test',
          isPrivate: false,
          callbackAddress: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
        },
        durationSeconds: 438,
        joinedDurationSeconds: 457,
        participantCount: 2,
        links: {
          locusUrl:
            'https://locus-a.wbx2.com/locus/api/v1/loci/f5dbe4da-663b-3f73-a2fc-3a2fb0f12080',
          conversationUrl:
            'https://conv-a.wbx2.com/conversation/api/v1/conversations/c9252ff0-9de2-11ec-a582-59d00c02cca9',
          callbackAddress: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
        },
        isDeleted: false,
        isPMR: false,
        correlationIds: ['58ea6cd9-852b-4a77-957f-e704c8b0e63e'],
      },
    ],
  },
};

export const mockCallHistoryBody = {
  body: {
    statusCode: 200,
    userSessions: [
      {
        id: 'd74d19cc-6aa7-f341-6012-aec433cc6f8d',
        durationSecs: 438,
        self: {
          id: 'a24027e7-9b6e-4047-a950-42f4492148ec',
          name: 'Mark',
          incomingCallProtocols: [],
          callbackInfo: {
            callbackAddress: 'test@cisco.com',
            callbackType: 'EMAIL',
          },
          lookUpInfo: {
            lookupLink:
              'https://conv-a.wbx2.com/conversation/api/v1/conversations/c9252ff0-9de2-11ec-a582-59d00c02cca9',
            type: 'CONVERSATION',
          },
        },
        url: 'https://janus-a.wbx2.com/janus/api/v1/history/userSessions/d74d19cc-6aa7-f341-6012-aec433cc6f8d',
        sessionId: 'd74d19cc-6aa7-f341-6012-aec433cc6f8d',
        sessionType: 'SPARK',
        startTime: '2022-08-22T10:45:21.565Z',
        endTime: '2022-08-22T10:53:01.624Z',
        direction: 'OUTGOING',
        disposition: 'INITIATED',
        other: {
          id: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
          name: 'test',
          isPrivate: false,
          callbackAddress: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
        },
        durationSeconds: 438,
        joinedDurationSeconds: 457,
        participantCount: 2,
        links: {
          locusUrl:
            'https://locus-a.wbx2.com/locus/api/v1/loci/f5dbe4da-663b-3f73-a2fc-3a2fb0f12080',
          conversationUrl:
            'https://conv-a.wbx2.com/conversation/api/v1/conversations/c9252ff0-9de2-11ec-a582-59d00c02cca9',
          callbackAddress: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
        },
        isDeleted: false,
        isPMR: false,
        correlationIds: ['58ea6cd9-852b-4a77-957f-e704c8b0e63e'],
      },
      {
        id: 'd74d19cc-6aa7-f341-6012-aec433cc6f8d',
        durationSecs: 438,
        self: {
          id: 'a24027e7-9b6e-4047-a950-42f4492148ec',
          name: 'Mark',
          incomingCallProtocols: [],
          callbackInfo: {
            callbackAddress: 'test@cisco.com',
            callbackType: 'EMAIL',
          },
          lookUpInfo: {
            lookupLink:
              'https://conv-a.wbx2.com/conversation/api/v1/conversations/c9252ff0-9de2-11ec-a582-59d00c02cca9',
            type: 'CONVERSATION',
          },
        },
        url: 'https://janus-a.wbx2.com/janus/api/v1/history/userSessions/d74d19cc-6aa7-f341-6012-aec433cc6f8d',
        sessionId: 'd74d19cc-6aa7-f341-6012-aec433cc6f8d',
        sessionType: 'SPARK',
        startTime: '2022-08-30T10:45:21.565Z',
        endTime: '2022-08-30T10:53:01.624Z',
        direction: 'OUTGOING',
        disposition: 'INITIATED',
        other: {
          id: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
          name: 'test',
          isPrivate: false,
          callbackAddress: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
        },
        durationSeconds: 438,
        joinedDurationSeconds: 457,
        participantCount: 2,
        links: {
          locusUrl:
            'https://locus-a.wbx2.com/locus/api/v1/loci/f5dbe4da-663b-3f73-a2fc-3a2fb0f12080',
          conversationUrl:
            'https://conv-a.wbx2.com/conversation/api/v1/conversations/c9252ff0-9de2-11ec-a582-59d00c02cca9',
          callbackAddress: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
        },
        isDeleted: false,
        isPMR: false,
        correlationIds: ['58ea6cd9-852b-4a77-957f-e704c8b0e63e'],
      },
      {
        id: 'd74d19cc-6aa7-f341-6012-aec433cc6f8d',
        durationSecs: 438,
        self: {
          id: 'a24027e7-9b6e-4047-a950-42f4492148ec',
          name: 'Mark',
          incomingCallProtocols: [],
          callbackInfo: {
            callbackAddress: 'test@cisco.com',
            callbackType: 'EMAIL',
          },
          lookUpInfo: {
            lookupLink:
              'https://conv-a.wbx2.com/conversation/api/v1/conversations/c9252ff0-9de2-11ec-a582-59d00c02cca9',
            type: 'CONVERSATION',
          },
        },
        url: 'https://janus-a.wbx2.com/janus/api/v1/history/userSessions/d74d19cc-6aa7-f341-6012-aec433cc6f8d',
        sessionId: 'd74d19cc-6aa7-f341-6012-aec433cc6f8d',
        sessionType: 'SPARK',
        startTime: '2022-08-09T10:45:21.565Z',
        endTime: '2022-08-09T10:53:01.624Z',
        direction: 'OUTGOING',
        disposition: 'INITIATED',
        other: {
          id: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
          name: 'test',
          isPrivate: false,
          callbackAddress: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
        },
        durationSeconds: 438,
        joinedDurationSeconds: 457,
        participantCount: 2,
        links: {
          locusUrl:
            'https://locus-a.wbx2.com/locus/api/v1/loci/f5dbe4da-663b-3f73-a2fc-3a2fb0f12080',
          conversationUrl:
            'https://conv-a.wbx2.com/conversation/api/v1/conversations/c9252ff0-9de2-11ec-a582-59d00c02cca9',
          callbackAddress: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
        },
        isDeleted: false,
        isPMR: false,
        correlationIds: ['58ea6cd9-852b-4a77-957f-e704c8b0e63e'],
      },
    ],
  },
};

/**
 * MOCK_CALL_HISTORY_WITH_UCM_LINE_NUMBER simulates a call history response where the session contains
 * both cucmDN and ucmLineNumber data. This implies that the cucmDN was successfully matched with the UCM lines data.
 */
export const MOCK_CALL_HISTORY_WITH_UCM_LINE_NUMBER = {
  body: {
    statusCode: 200,
    userSessions: [
      {
        id: '123456',
        durationSecs: 438,
        self: {
          id: 'fd2e1234',
          name: 'Mark',
          cucmDN: '1001',
          ucmLineNumber: 1,
          incomingCallProtocols: [],
          callbackInfo: {
            callbackAddress: 'test@cisco.com',
            callbackType: 'EMAIL',
          },
          lookUpInfo: {
            lookupLink: 'https://conv-a.wbx2.com/conversation/api/v1/conversations/98765',
            type: 'CONVERSATION',
          },
        },
        url: 'https://janus-a.wbx2.com/janus/api/v1/history/userSessions/654321',
        sessionId: '123456',
        sessionType: 'SPARK',
        startTime: '2022-08-22T10:45:21.565Z',
        endTime: '2022-08-22T10:53:01.624Z',
        direction: 'OUTGOING',
        disposition: 'INITIATED',
        other: {
          id: '100001',
          name: 'test',
          isPrivate: false,
          callbackAddress: '89998888',
        },
        durationSeconds: 438,
        joinedDurationSeconds: 457,
        participantCount: 2,
        links: {
          locusUrl: 'https://locus-a.wbx2.com/locus/api/v1/loci/786765',
          conversationUrl: 'https://conv-a.wbx2.com/conversation/api/v1/conversations/55443322',
          callbackAddress: '01010101',
        },
        isDeleted: false,
        isPMR: false,
        correlationIds: ['008899'],
      },
      {
        id: '20191817',
        durationSecs: 438,
        self: {
          id: '12131415',
          name: 'Mark',
          cucmDN: '1002',
          ucmLineNumber: 2,
          incomingCallProtocols: [],
          callbackInfo: {
            callbackAddress: 'test@cisco.com',
            callbackType: 'EMAIL',
          },
          lookUpInfo: {
            lookupLink: 'https://conv-a.wbx2.com/conversation/api/v1/conversations/21314151',
            type: 'CONVERSATION',
          },
        },
        url: 'https://janus-a.wbx2.com/janus/api/v1/history/userSessions/100101102',
        sessionId: '20191817',
        sessionType: 'SPARK',
        startTime: '2022-08-30T10:45:21.565Z',
        endTime: '2022-08-30T10:53:01.624Z',
        direction: 'OUTGOING',
        disposition: 'INITIATED',
        other: {
          id: '301302303',
          name: 'test',
          isPrivate: false,
          callbackAddress: '401402403',
        },
        durationSeconds: 438,
        joinedDurationSeconds: 457,
        participantCount: 2,
        links: {
          locusUrl: 'https://locus-a.wbx2.com/locus/api/v1/loci/501502503',
          conversationUrl: 'https://conv-a.wbx2.com/conversation/api/v1/conversations/601602603',
          callbackAddress: '801802803',
        },
        isDeleted: false,
        isPMR: false,
        correlationIds: ['901902903'],
      },
    ],
  },
};

/**
 * MOCK_CALL_HISTORY_WITHOUT_UCM_LINE_NUMBER simulates a call history response where the session contains
 * cucmDN, but no ucmLineNumber is present. This implies that the cucmDN was not matched with any UCM lines data.
 */
export const MOCK_CALL_HISTORY_WITHOUT_UCM_LINE_NUMBER = {
  body: {
    statusCode: 200,
    userSessions: [
      {
        id: '123456',
        durationSecs: 438,
        self: {
          id: 'fd2e1234',
          name: 'Mark',
          cucmDN: '1001',
          incomingCallProtocols: [],
          callbackInfo: {
            callbackAddress: 'test@cisco.com',
            callbackType: 'EMAIL',
          },
          lookUpInfo: {
            lookupLink: 'https://conv-a.wbx2.com/conversation/api/v1/conversations/98765',
            type: 'CONVERSATION',
          },
        },
        url: 'https://janus-a.wbx2.com/janus/api/v1/history/userSessions/654321',
        sessionId: '123456',
        sessionType: 'SPARK',
        startTime: '2022-08-22T10:45:21.565Z',
        endTime: '2022-08-22T10:53:01.624Z',
        direction: 'OUTGOING',
        disposition: 'INITIATED',
        other: {
          id: '100001',
          name: 'test',
          isPrivate: false,
          callbackAddress: '89998888',
        },
        durationSeconds: 438,
        joinedDurationSeconds: 457,
        participantCount: 2,
        links: {
          locusUrl: 'https://locus-a.wbx2.com/locus/api/v1/loci/786765',
          conversationUrl: 'https://conv-a.wbx2.com/conversation/api/v1/conversations/55443322',
          callbackAddress: '01010101',
        },
        isDeleted: false,
        isPMR: false,
        correlationIds: ['008899'],
      },
      {
        id: '20191817',
        durationSecs: 438,
        self: {
          id: '12131415',
          name: 'Mark',
          cucmDN: '1002',
          incomingCallProtocols: [],
          callbackInfo: {
            callbackAddress: 'test@cisco.com',
            callbackType: 'EMAIL',
          },
          lookUpInfo: {
            lookupLink: 'https://conv-a.wbx2.com/conversation/api/v1/conversations/21314151',
            type: 'CONVERSATION',
          },
        },
        url: 'https://janus-a.wbx2.com/janus/api/v1/history/userSessions/100101102',
        sessionId: '20191817',
        sessionType: 'SPARK',
        startTime: '2022-08-30T10:45:21.565Z',
        endTime: '2022-08-30T10:53:01.624Z',
        direction: 'OUTGOING',
        disposition: 'INITIATED',
        other: {
          id: '301302303',
          name: 'test',
          isPrivate: false,
          callbackAddress: '401402403',
        },
        durationSeconds: 438,
        joinedDurationSeconds: 457,
        participantCount: 2,
        links: {
          locusUrl: 'https://locus-a.wbx2.com/locus/api/v1/loci/501502503',
          conversationUrl: 'https://conv-a.wbx2.com/conversation/api/v1/conversations/601602603',
          callbackAddress: '801802803',
        },
        isDeleted: false,
        isPMR: false,
        correlationIds: ['901902903'],
      },
    ],
  },
};

const WEBEX_CALL_SESSION = {
  id: 'd74d19cc-6aa7-f341-6012-aec433cc6f8d',
  durationSecs: 438,
  self: {
    id: 'a24027e7-9b6e-4047-a950-42f4492148ec',
    name: 'Mark',
    phoneNumber: '123456',
  },
  url: 'https://janus-a.wbx2.com/janus/api/v1/history/userSessions/d74d19cc-6aa7-f341-6012-aec433cc6f8d',
  sessionId: 'd74d19cc-6aa7-f341-6012-aec433cc6f8d',
  sessionType: SessionType.WEBEX_CALLING,
  startTime: '2022-08-02T10:45:21.565Z',
  endTime: '2022-08-02T10:53:01.624Z',
  direction: 'OUTGOING',
  disposition: Disposition.INITIATED,
  other: {
    id: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
    name: 'test',
    isPrivate: false,
    callbackAddress: 'c9bde63c-e3e2-4db4-ba45-0d6c698ffd65',
    phoneNumber: '123456679',
  },
  durationSeconds: 438,
  joinedDurationSeconds: 457,
  participantCount: 2,
  links: {
    locusUrl: 'https://locus-a.wbx2.com/locus/api/v1/loci/f5dbe4da-663b-3f73-a2fc-3a2fb0f12080',
    conversationUrl:
      'https://conv-a.wbx2.com/conversation/api/v1/conversations/c9252ff0-9de2-11ec-a582-59d00c02cca9',
    callbackAddress: '123-456-7890',
  },
  callingSpecifics: {
    redirectionDetails: {
      phoneNumber: '+18308508011',
      name: 'Test QA Call Center',
      reason: 'CALLQUEUE',
      userId: '604a966d-7518-4b74-8d78-6c05caf98239',
      isPrivate: false,
    },
  },
  isDeleted: false,
  isPMR: false,
  correlationIds: ['58ea6cd9-852b-4a77-957f-e704c8b0e63e'],
};

const SPARK_CALL_SESSION = {
  id: '2ce4b9e0-7ee7-12a1-4a94-df524443b520',
  durationSecs: 0,
  self: {
    id: '0fea4a63-4e27-46ee-99c3-2472cb12bf68',
    name: 'Alice',
    incomingCallProtocols: [],
    callbackInfo: {
      callbackAddress: 'alice@cisco.com',
      callbackType: 'EMAIL',
    },
  },
  url: 'https://janus-a.wbx2.com/janus/api/v1/history/userSessions/2ce4b9e0-7ee7-12a1-4a94-df524443b520',
  sessionId: '2ce4b9e0-7ee7-12a1-4a94-df524443b520',
  sessionType: SessionType.SPARK,
  startTime: '2024-02-23T09:12:31.703Z',
  endTime: '2024-02-23T09:12:39.468Z',
  direction: 'OUTGOING',
  disposition: Disposition.INITIATED,
  other: {
    id: '8391c34e-9cb1-4fd0-b868-31902c02290c',
    name: 'Umar Patel',
    isPrivate: false,
    callbackAddress: '8391c34e-9cb1-4fd0-b868-31902c02290c',
  },
  durationSeconds: 0,
  joinedDurationSeconds: 7,
  participantCount: 2,
  links: {
    locusUrl: 'https://locus-a.wbx2.com/locus/api/v1/loci/bdb775e5-e7ad-370c-8fa9-b5d7e2795ae2',
    conversationUrl:
      'https://conv-a.wbx2.com/conversation/api/v1/conversations/0ed14356-1bf5-3eb9-99d6-9f7a3ad07426',
    callbackAddress: '8391c34e-9cb1-4fd0-b868-31902c02290c',
  },
  isDeleted: false,
  isPMR: false,
  isTest: false,
  correlationIds: ['dfe83701-3e1f-4e1d-8aeb-6fe81f53b653'],
};

const SPARK_CALL_VIEWED_SESSION = {
  sessionId: '2ce4b9e0-7ee7-12a1-4a94-df524443b520',
};

export const MOCK_SESSION_EVENT: CallSessionEvent = {
  id: 'id',
  data: {
    userSessions: {
      userSessions: [WEBEX_CALL_SESSION],
      statusCode: 0,
    },
    eventType: MOBIUS_EVENT_KEYS.CALL_SESSION_EVENT_INCLUSIVE,
  },
  timestamp: 12345,
  trackingId: 'tracking-id',
};

export const MOCK_SESSION_EVENT_LEGACY: CallSessionEvent = {
  id: 'id',
  data: {
    userSessions: {
      userSessions: [SPARK_CALL_SESSION],
      statusCode: 0,
    },
    eventType: MOBIUS_EVENT_KEYS.CALL_SESSION_EVENT_LEGACY,
  },
  timestamp: 12345,
  trackingId: 'tracking-id',
};

export const MOCK_SESSION_EVENT_VIEWED: CallSessionViewedEvent = {
  id: 'id',
  data: {
    userReadSessions: {
      userReadSessions: [SPARK_CALL_VIEWED_SESSION],
      statusCode: 0,
    },
    eventType: MOBIUS_EVENT_KEYS.CALL_SESSION_EVENT_VIEWED,
  },
  timestamp: 12345,
  trackingId: 'tracking-id',
};

export const MOCK_UPDATE_MISSED_CALL_RESPONSE: UpdateMissedCallsResponse = {
  statusCode: 200,
  data: {
    readStatusMessage: 'Missed calls are read by the user.',
  },
  message: 'SUCCESS',
};
export const janusSetReadStateUrl =
  'https://janus-intb.ciscospark.com/janus/api/v1/history/userSessions/setReadState';

export const ERROR_DETAILS_401 = {
  statusCode: 401,
  data: {
    error: 'User is unauthorised, possible token expiry',
  },
  message: 'FAILURE',
};
export const ERROR_DETAILS_400 = {
  statusCode: 400,
  data: {
    error: '400 Bad request',
  },
  message: 'FAILURE',
};

/*
 * MOCK_LINES_API_CALL_RESPONSE simulates a successful response from the UCM lines API.
 */
export const MOCK_LINES_API_CALL_RESPONSE: UCMLinesResponse = {
  statusCode: 200,
  data: {
    lines: {
      devices: [
        {
          name: 'CSFheliosucm01',
          model: 503,
          lines: [
            {
              dnorpattern: '+14928000001',
              index: 1,
              label: '',
            },
            {
              dnorpattern: '+14928000003',
              index: 2,
              label: '',
            },
          ],
        },
      ],
    },
  },
  message: 'SUCCESS',
};

/**
 * MOCK_LINES_API_CALL_RESPONSE_WITH_NO_LINEDATA simulates a successful UCM lines API response
 * where no line data is present. The `lines` field is empty, indicating no devices or lines available.
 */
export const MOCK_LINES_API_CALL_RESPONSE_WITH_NO_LINEDATA: UCMLinesResponse = {
  statusCode: 200,
  data: {},
  message: 'SUCCESS',
};
