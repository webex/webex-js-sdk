import {NoiseReductionEffect, createMicrophoneStream} from '@webex/media-helpers';
import {ERROR_LAYER} from './Errors/types';
import {ICallingClient} from './CallingClient/types';
import {ICallHistory, JanusResponseEvent} from './CallHistory/types';
import {
  CallForwardSetting,
  CallSettingResponse,
  ICallSettings,
  VoicemailSetting,
} from './CallSettings/types';
import {Contact, ContactResponse, GroupType, IContacts} from './Contacts/types';
import {IVoicemail, SummaryInfo, VoicemailResponseEvent} from './Voicemail/types';
import {ILine, LINE_EVENTS} from './CallingClient/line/types';
import {
  CALLING_CLIENT_EVENT_KEYS,
  CALL_EVENT_KEYS,
  CallerIdDisplay,
  Disposition,
  LINE_EVENT_KEYS,
} from './Events/types';
import {CallDetails, CallDirection, CallType, DisplayInformation, SORT} from './common/types';
import {CallError} from './Errors';
import {ICall, TransferType} from './CallingClient/calling/types';
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

// Interfaces
export {ICallingClient, ICallHistory, ICallSettings, IContacts, IVoicemail, ICall, ILine};

export {
  CallDetails,
  CallDirection,
  CallerIdDisplay,
  CallError,
  CALL_EVENT_KEYS,
  CALLING_CLIENT_EVENT_KEYS,
  CallType,
  DisplayInformation,
  Disposition,
  ERROR_LAYER,
  LINE_EVENTS,
  LINE_EVENT_KEYS,
  SORT,
  SummaryInfo,
  TransferType,
  CallForwardSetting,
  CallSettingResponse,
  Contact,
  ContactResponse,
  GroupType,
  JanusResponseEvent,
  VoicemailSetting,
  VoicemailResponseEvent,
};
