/* eslint-disable import/no-unresolved */
import {CallHistory, createCallHistoryClient} from './CallHistory/CallHistory';
import {ICallHistory} from './CallHistory/types';
import {CallSettings, createCallSettingsClient} from './CallSettings/CallSettings';
import {
  ICallSettings,
  CallForwardSetting,
  VoicemailSetting,
  CallForwardAlwaysSetting,
} from './CallSettings/types';

import {CallingClient, createClient} from './CallingClient/CallingClient';
import {ICall} from './CallingClient/calling/types';
import {ILine} from './CallingClient/line/types';
import {ICallingClient} from './CallingClient/types';
import {ContactsClient, createContactsClient} from './Contacts/ContactsClient';
import {IContacts, Contact, ContactGroup} from './Contacts/types';
import {Voicemail, createVoicemailClient} from './Voicemail/Voicemail';
import {IVoicemail, VoicemailResponseEvent} from './Voicemail/types';
import {CallRecording, createCallRecordingClient} from './CallRecording/CallRecording';
import {CallQueueClient, createCallQueueClient} from './CallQueue/CallQueue';
import {ICallQueue, ACD_STATE, UpdateCallQueueSettingsRequest} from './CallQueue/types';
import {
  ICallRecording,
  Recording,
  RecordingListResponse,
  RecordingMetadata,
  RecordingMetadataResponse,
  RecordingResponse,
  GetRecordingsOptions,
} from './CallRecording/types';

// Interfaces
export {
  ILine,
  ICall,
  ICallHistory,
  ICallSettings,
  ICallingClient,
  IContacts,
  IVoicemail,
  ICallRecording,
  ICallQueue,
};

// Classes
export {
  CallHistory,
  CallSettings,
  CallingClient,
  ContactsClient,
  Voicemail,
  CallRecording,
  CallQueueClient,
};

// Types
export {
  ContactGroup,
  Contact,
  CallForwardSetting,
  CallForwardAlwaysSetting,
  VoicemailSetting,
  VoicemailResponseEvent,
  Recording,
  RecordingListResponse,
  RecordingMetadata,
  RecordingMetadataResponse,
  RecordingResponse,
  GetRecordingsOptions,
  ACD_STATE,
  UpdateCallQueueSettingsRequest,
};

// Methods
export {
  createCallHistoryClient,
  createCallSettingsClient,
  createClient,
  createContactsClient,
  createVoicemailClient,
  createCallRecordingClient,
  createCallQueueClient,
};
