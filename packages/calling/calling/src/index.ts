import {createCallSettingsClient} from './CallSettings/CallSettings';
import {createContactsClient} from './Contacts/ContactsClient';
import {createClient} from './CallingClient/CallingClient';
import {createCallHistoryClient} from './CallHistory/CallHistory';
import {createVoicemailClient} from './Voicemail/Voicemail';
import Logger from './Logger';

export {createMicrophoneStream} from '@webex/media-helpers';

export {
  createClient,
  createCallHistoryClient,
  createVoicemailClient,
  createContactsClient,
  createCallSettingsClient,
  Logger,
};
