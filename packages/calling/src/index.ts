import {NoiseReductionEffect, createMicrophoneStream} from '@webex/media-helpers';
import {createCallSettingsClient} from './CallSettings/CallSettings';
import {createContactsClient} from './Contacts/ContactsClient';
import {createClient} from './CallingClient/CallingClient';
import {createCallHistoryClient} from './CallHistory/CallHistory';
import {createVoicemailClient} from './Voicemail/Voicemail';
import Logger from './Logger';

export {
  createClient,
  createCallHistoryClient,
  createCallSettingsClient,
  createContactsClient,
  createMicrophoneStream,
  createVoicemailClient,
  Logger,
  NoiseReductionEffect,
};

export {ERROR_LAYER, ERROR_TYPE} from './Errors/types';
export {ICallingClient} from './CallingClient/types';
export {ICallHistory, JanusResponseEvent} from './CallHistory/types';
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
  UserSession,
} from './Events/types';
export {
  CallDetails,
  CallDirection,
  CallType,
  DisplayInformation,
  SORT,
  SORT_BY,
} from './common/types';
export {CallError, LineError} from './Errors';
export {ICall, TransferType} from './CallingClient/calling/types';
export {LOGGER} from './Logger/types';
export {LocalMicrophoneStream} from '@webex/media-helpers';
