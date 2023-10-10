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
import {ICallManager, ICall} from './CallingClient/calling/types';
import {ILine} from './CallingClient/line/types';
import {IRegistration} from './CallingClient/registration/types';
import {ICallingClient} from './CallingClient/types';
import {ContactsClient, createContactsClient} from './Contacts/ContactsClient';
import {IContacts, Contact, ContactGroup} from './Contacts/types';
import {Voicemail, createVoicemailClient} from './Voicemail/Voicemail';
import {IVoicemail} from './Voicemail/types';

// Interfaces
export {
  IRegistration,
  ILine,
  ICallManager,
  ICall,
  ICallHistory,
  ICallSettings,
  ICallingClient,
  IContacts,
  IVoicemail,
};

// Classes
export {CallHistory, CallSettings, CallingClient, ContactsClient, Voicemail};

// Types
export {ContactGroup, Contact, CallForwardSetting, CallForwardAlwaysSetting, VoicemailSetting};

// Methods
export {
  createCallHistoryClient,
  createCallSettingsClient,
  createClient,
  createContactsClient,
  createVoicemailClient,
};
