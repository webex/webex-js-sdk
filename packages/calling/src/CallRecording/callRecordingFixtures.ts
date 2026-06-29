import {
  MOBIUS_EVENT_KEYS,
  RECORDING_EVENT_SUBTYPE,
  RECORDING_EVENT_TYPE,
  RecordingEvent,
} from '../Events/types';
import {Recording, RecordingMetadata, RecordingStatus} from './types';

export const CALL_SESSION_ID = 'a1b2c3d4-1111-2222-3333-444455556666';

export const RECORDING_ONE: Recording = {
  id: '11111111-aaaa-bbbb-cccc-222222222222',
  topic: 'Call with Alice',
  createTime: '2024-05-01T10:01:05.000Z',
  timeRecorded: '2024-05-01T10:00:00.000Z',
  format: 'MP3',
  serviceType: 'calling',
  durationSeconds: 65,
  sizeBytes: 1048576,
  status: RecordingStatus.AVAILABLE,
  ownerId: '8a67806f-fc4d-446b-a131-31e71ea5b0e9',
  ownerEmail: 'owner@cisco.com',
  ownerType: 'user',
  storageRegion: 'US',
  serviceData: {
    locationId: 'loc-1',
    callSessionId: CALL_SESSION_ID,
  },
};

export const RECORDING_TWO: Recording = {
  id: '33333333-dddd-eeee-ffff-444444444444',
  topic: 'Call with Bob',
  createTime: '2024-05-02T11:02:05.000Z',
  timeRecorded: '2024-05-02T11:00:00.000Z',
  format: 'MP3',
  serviceType: 'calling',
  durationSeconds: 120,
  sizeBytes: 2097152,
  status: RecordingStatus.AVAILABLE,
  ownerId: '8a67806f-fc4d-446b-a131-31e71ea5b0e9',
  ownerEmail: 'owner@cisco.com',
  ownerType: 'user',
  storageRegion: 'US',
  serviceData: {
    locationId: 'loc-1',
    callSessionId: 'ffffffff-9999-8888-7777-666666666666',
  },
};

export const MOCK_RECORDING_LIST_BODY = {
  statusCode: 200,
  body: {
    items: [RECORDING_ONE, RECORDING_TWO],
  },
};

export const MOCK_EMPTY_RECORDING_LIST_BODY = {
  statusCode: 200,
  body: {
    items: [],
  },
};

export const MOCK_RECORDING_BODY = {
  statusCode: 200,
  body: RECORDING_ONE,
};

export const RECORDING_OWNER_ID = '8a67806f-fc4d-446b-a131-31e71ea5b0e9';
export const RECORDING_REMOTE_PARTY_ID = '0fea4a63-4e27-46ee-99c3-2472cb12bf68';

export const MOCK_RECORDING_METADATA: RecordingMetadata = {
  id: RECORDING_ONE.id,
  callSessionId: CALL_SESSION_ID,
  owner: {
    ownerID: RECORDING_OWNER_ID,
    ownerEmail: 'owner@cisco.com',
    ownerName: 'Mark',
    orgID: '1704d30d-a131-4bc7-9449-948487643793',
  },
  participants: [
    {id: RECORDING_OWNER_ID, name: 'Mark', email: 'owner@cisco.com'},
    {id: RECORDING_REMOTE_PARTY_ID, name: 'Alice', email: 'alice@cisco.com'},
  ],
  mediaStreams: [{streamId: 'audio-1', type: 'audio', codec: 'opus', durationMS: 65000}],
  extensionData: {
    callData: {direction: 'OUTGOING'},
    acd: {},
    redirectInfo: {},
  },
  // The owner placed the call (`originator`), so the remote party is `calledParty`.
  serviceData: {
    callRecordingId: RECORDING_ONE.id,
    locationId: 'loc-1',
    callSessionId: CALL_SESSION_ID,
    personality: 'originator',
    callingParty: {
      actor: {type: 'USER', id: RECORDING_OWNER_ID, email: 'owner@cisco.com'},
      number: '9902',
      name: 'Mark',
    },
    calledParty: {
      actor: {type: 'USER', id: RECORDING_REMOTE_PARTY_ID, email: 'alice@cisco.com'},
      number: '9903',
      name: 'Alice',
    },
  },
};

export const MOCK_RECORDING_METADATA_BODY = {
  statusCode: 200,
  body: MOCK_RECORDING_METADATA,
};

export const ERROR_DETAILS_400 = {
  statusCode: 400,
  data: {
    error: '400 Bad request',
  },
  message: 'FAILURE',
};

export const ERROR_DETAILS_401 = {
  statusCode: 401,
  data: {
    error: 'User is unauthorised, possible token expiry',
  },
  message: 'FAILURE',
};

export const ERROR_DETAILS_404 = {
  statusCode: 404,
  data: {
    error: 'User info not found',
  },
  message: 'FAILURE',
};

const RECORDING_ACTIVITY = {
  id: 'activity-1',
  objectType: 'activity',
  verb: 'add',
  published: '2024-05-01T10:01:05.000Z',
  actor: {
    id: '8a67806f-fc4d-446b-a131-31e71ea5b0e9',
    objectType: 'person',
    emailAddress: 'owner@cisco.com',
  },
  object: {
    id: RECORDING_ONE.id,
    objectType: 'wxCallingCallRecording',
    callSessionId: CALL_SESSION_ID,
    durationSeconds: 65,
    sizeBytes: 1048576,
  },
};

export const MOCK_RECORDING_CREATED_EVENT: RecordingEvent = {
  id: 'event-created',
  data: {
    activity: RECORDING_ACTIVITY,
    eventType: RECORDING_EVENT_TYPE.CREATED,
  },
  timestamp: 12345,
  trackingId: 'tracking-id',
};

export const MOCK_RECORDING_UPDATED_EVENT: RecordingEvent = {
  id: 'event-updated',
  data: {
    activity: RECORDING_ACTIVITY,
    eventType: RECORDING_EVENT_TYPE.UPDATED,
    eventSubType: RECORDING_EVENT_SUBTYPE.SUMMARY_CREATE,
  },
  timestamp: 12346,
  trackingId: 'tracking-id',
};

export const MOCK_RECORDING_DELETED_EVENT: RecordingEvent = {
  id: 'event-deleted',
  data: {
    activity: RECORDING_ACTIVITY,
    eventType: RECORDING_EVENT_TYPE.DELETED,
  },
  timestamp: 12347,
  trackingId: 'tracking-id',
};

// A delete performed in the Webex client arrives as an `updated` event with a `TRASH` (soft delete)
// sub-type, not a dedicated `deleted` event. `PURGE` is the permanent variant.
export const MOCK_RECORDING_TRASH_EVENT: RecordingEvent = {
  id: 'event-trash',
  data: {
    activity: RECORDING_ACTIVITY,
    eventType: RECORDING_EVENT_TYPE.UPDATED,
    eventSubType: RECORDING_EVENT_SUBTYPE.TRASH,
  },
  timestamp: 12348,
  trackingId: 'tracking-id',
};

export const MOCK_RECORDING_PURGE_EVENT: RecordingEvent = {
  id: 'event-purge',
  data: {
    activity: RECORDING_ACTIVITY,
    eventType: RECORDING_EVENT_TYPE.UPDATED,
    eventSubType: RECORDING_EVENT_SUBTYPE.PURGE,
  },
  timestamp: 12349,
  trackingId: 'tracking-id',
};

// A restore from trash re-adds the recording, delivered as an `updated` event with `RESTORE`.
export const MOCK_RECORDING_RESTORE_EVENT: RecordingEvent = {
  id: 'event-restore',
  data: {
    activity: RECORDING_ACTIVITY,
    eventType: RECORDING_EVENT_TYPE.UPDATED,
    eventSubType: RECORDING_EVENT_SUBTYPE.RESTORE,
  },
  timestamp: 12350,
  trackingId: 'tracking-id',
};

export const RECORDING_MERCURY_KEYS = {
  CREATED: MOBIUS_EVENT_KEYS.RECORDING_EVENT_CREATED,
  UPDATED: MOBIUS_EVENT_KEYS.RECORDING_EVENT_UPDATED,
  DELETED: MOBIUS_EVENT_KEYS.RECORDING_EVENT_DELETED,
};
