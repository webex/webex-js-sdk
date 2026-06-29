import {NoiseReductionEffect, createMicrophoneStream} from '@webex/media-helpers';
import {createCallSettingsClient} from './CallSettings/CallSettings';
import {createContactsClient} from './Contacts/ContactsClient';
import {createClient} from './CallingClient/CallingClient';
import {createCallHistoryClient} from './CallHistory/CallHistory';
import {createVoicemailClient} from './Voicemail/Voicemail';
import {createCallRecordingClient} from './CallRecording/CallRecording';
import Logger from './Logger';

export {
  createClient,
  createCallHistoryClient,
  createCallSettingsClient,
  createContactsClient,
  createMicrophoneStream,
  createVoicemailClient,
  createCallRecordingClient,
  Logger,
  NoiseReductionEffect,
};

export {ERROR_LAYER, ERROR_TYPE} from './Errors/types';
export {ICallingClient} from './CallingClient/types';
export {ICallHistory, JanusResponseEvent} from './CallHistory/types';
export {
  ICallRecording,
  Recording,
  RecordingListResponse,
  RecordingMetadata,
  RecordingMetadataResponse,
  RecordingResponse,
  RecordingStatus,
  RecordingDeleteResponse,
  DeleteRecordingOptions,
  GetRecordingsOptions,
  RecordingRequestType,
  GetCallRecordingRequest,
  RecordingResponseFor,
} from './CallRecording/types';
export {getRemoteParty} from './CallRecording/utils';
export {
  CallForwardSetting,
  CallForwardAlwaysSetting,
  CallSettingResponse,
  ICallSettings,
  ToggleSetting,
  VoicemailSetting,
} from './CallSettings/types';
export {Contact, ContactResponse, GroupType, IContacts} from './Contacts/types';
export {IVoicemail, SummaryInfo, VoicemailResponseEvent} from './Voicemail/types';
export {ILine, LINE_EVENTS} from './CallingClient/line/types';
export {
  CALLING_CLIENT_EVENT_KEYS,
  CALL_EVENT_KEYS,
  CallerIdDisplay,
  Disposition,
  LINE_EVENT_KEYS,
  COMMON_EVENT_KEYS,
  MOBIUS_SOCKET_DISCONNECT_REASON,
  MobiusSocketDisconnectedEvent,
  UserSession,
} from './Events/types';
export {
  CallDetails,
  CallDirection,
  CallType,
  CALLING_BACKEND,
  DisplayInformation,
  SORT,
  SORT_BY,
} from './common/types';
export {resolveCallingBackend} from './common/Utils';
export {WDMDevice} from './SDKConnector/types';
export {CallError, LineError} from './Errors';
export {ICall, TransferType} from './CallingClient/calling/types';
export {LOGGER} from './Logger/types';
export {LocalMicrophoneStream} from '@webex/media-helpers';
export {CallingClientConfig} from './CallingClient/types';
export {ServiceIndicator} from './common/types';
