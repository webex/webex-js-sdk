import {USERHUB_RECORDINGS_PATH} from './constants';
import {Recording, RecordingMetadata, RecordingPersonality, RecordingStatus} from './types';

export type UserhubCallingData = {
  locationID?: string;
  callingActorType?: string;
  calledActorType?: string;
  callingActorID?: string;
  calledActorID?: string;
  callingName?: string;
  calledName?: string;
  callingNumber?: string;
  calledNumber?: string;
  callSessionID?: string;
  personality?: string;
};

export type UserhubRecording = {
  recordUUID?: string;
  id?: string;
  title?: string;
  topic?: string;
  ownerEmail?: string;
  ownerID?: string;
  durationMS?: number;
  durationSeconds?: number;
  status?: string;
  format?: string;
  sizeByte?: number;
  storageLocation?: string;
  appCreateTime?: string;
  startRecordingTime?: string;
  callingData?: UserhubCallingData;
  recordingPlaybackLinks?: Recording['recordingPlaybackLinks'];
  aiAssistantData?: Recording['aiAssistantData'];
};

export type UserhubRecordingListBody = {
  recordings?: UserhubRecording[];
  items?: UserhubRecording[];
};

export function joinUserhubRecordingsUrl(baseUrl: string): string {
  const trimmed = (baseUrl || '').replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }
  if (trimmed.includes(`/${USERHUB_RECORDINGS_PATH}`)) {
    return trimmed.replace(/\/+$/, '');
  }
  if (trimmed.endsWith('/webappng/api/v1')) {
    return `${trimmed}/hub/convergedRecordings`;
  }
  if (trimmed.endsWith('/webappng')) {
    return `${trimmed}/api/v1/hub/convergedRecordings`;
  }

  return `${trimmed}/${USERHUB_RECORDINGS_PATH}`;
}

export function unwrapUserhubRecording(
  body: UserhubRecording | {recording?: UserhubRecording} | null | undefined
): UserhubRecording {
  if (!body || typeof body !== 'object') {
    return {};
  }
  if ('recording' in body && body.recording && typeof body.recording === 'object') {
    return body.recording;
  }

  return body as UserhubRecording;
}

function toIsoTime(value?: string): string | undefined {
  const raw = (value ?? '').trim();
  if (!raw) {
    return undefined;
  }
  const normalized =
    raw.includes(' ') && !raw.includes('T')
      ? `${raw.replace(' ', 'T')}${/Z|[+-]\d{2}:?\d{2}$/.test(raw) ? '' : 'Z'}`
      : raw;
  const parsed = Date.parse(normalized);

  return Number.isNaN(parsed) ? raw : new Date(parsed).toISOString();
}

function mapPersonality(value?: string): RecordingPersonality | undefined {
  const personality = (value ?? '').trim().toLowerCase();
  if (personality === 'terminator' || personality === 'terminating' || personality === 'callee') {
    return 'terminator';
  }
  if (personality === 'originator' || personality === 'originating' || personality === 'caller') {
    return 'originator';
  }

  return undefined;
}

export function mapUserhubRecording(item: UserhubRecording): Recording {
  const id = (item.recordUUID || item.id || '').trim();
  const callingData = item.callingData;
  const personality = mapPersonality(callingData?.personality);
  const durationSeconds =
    typeof item.durationSeconds === 'number'
      ? item.durationSeconds
      : Math.round(Number(item.durationMS ?? 0) / 1000);

  return {
    id,
    topic: (item.title || item.topic || '').trim() || undefined,
    createTime: toIsoTime(item.appCreateTime),
    timeRecorded: toIsoTime(item.startRecordingTime || item.appCreateTime),
    format: item.format,
    serviceType: 'calling',
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : undefined,
    sizeBytes: item.sizeByte,
    status:
      (item.status ?? '').toLowerCase() === RecordingStatus.DELETED
        ? RecordingStatus.DELETED
        : RecordingStatus.AVAILABLE,
    ownerId: item.ownerID,
    ownerEmail: item.ownerEmail,
    recordingPlaybackLinks: item.recordingPlaybackLinks,
    aiAssistantData: item.aiAssistantData,
    serviceData: {
      locationId: callingData?.locationID,
      callSessionId: callingData?.callSessionID,
      personality,
      callingParty: {
        actor: {type: callingData?.callingActorType, id: callingData?.callingActorID},
        name: callingData?.callingName,
        number: callingData?.callingNumber,
      },
      calledParty: {
        actor: {type: callingData?.calledActorType, id: callingData?.calledActorID},
        name: callingData?.calledName,
        number: callingData?.calledNumber,
      },
    },
  };
}

export function mapUserhubMetadata(item: UserhubRecording): RecordingMetadata {
  const recording = mapUserhubRecording(item);

  return {
    id: recording.id,
    callSessionId: recording.serviceData?.callSessionId,
    owner: {
      ownerID: recording.ownerId,
      ownerEmail: recording.ownerEmail,
    },
    serviceData: recording.serviceData,
  };
}
