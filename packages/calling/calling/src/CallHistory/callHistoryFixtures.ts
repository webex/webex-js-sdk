import {Disposition, MOBIUS_EVENT_KEYS, CallSessionEvent, SessionType} from '../Events/types';

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

  isDeleted: false,
  isPMR: false,
  correlationIds: ['58ea6cd9-852b-4a77-957f-e704c8b0e63e'],
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
