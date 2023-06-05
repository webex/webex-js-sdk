import * as Media from '@webex/internal-media-core';
import {WebexSDK} from '../SDKConnector/types';
import {ICallSettings} from '../CallSettings/types';
import {createCallSettingsClient} from '../CallSettings/CallSettings';
import {createContactsClient} from '../Contacts/ContactsClient';
import {IContacts} from '../Contacts/types';
import {createClient} from '../CallingClient/CallingClient';
import {ICallingClient, LoggerConfig, CallingClientConfig} from '../CallingClient/types';
import {createCallHistoryClient} from '../CallHistory/CallHistory';
import {ICallHistory} from '../CallHistory/types';
import {IVoicemail} from '../Voicemail/types';
import {createVoicemailClient} from '../Voicemail/Voicemail';

declare global {
  interface Window {
    CreateClient?: (webex: WebexSDK, config?: CallingClientConfig) => ICallingClient;
    Media: typeof Media;
    /* Add additional hooks here */
    CreateCallHistoryClient?: (webex: WebexSDK, logger: LoggerConfig) => ICallHistory;
    CreateVoicemailClient?: (webex: WebexSDK, logger: LoggerConfig) => IVoicemail;
    CreateContactsClient?: (webex: WebexSDK, logger: LoggerConfig) => IContacts;
    CreateCallSettingsClient?: (webex: WebexSDK, logger: LoggerConfig) => ICallSettings;
    CreateWebexInstance?: (token: string) => WebexSDK;
  }
}

/**
 * .
 *
 * @param webex - A webex instance.
 * @param logger - Logger to set logger level.
 * @param config -.
 */
window.CreateClient = (webex: WebexSDK, config?: CallingClientConfig): ICallingClient =>
  createClient(webex, config);
window.Media = Media;
/**
 * .
 *
 * @param webex - A webex instance.
 * @param logger - Logger to set logger level.
 */
window.CreateCallHistoryClient = (webex: WebexSDK, logger: LoggerConfig): ICallHistory =>
  createCallHistoryClient(webex, logger);

/**
 * .
 *
 * @param webex - A webex instance.
 * @param logger - Logger to set logger level.
 */
window.CreateVoicemailClient = (webex: WebexSDK, logger: LoggerConfig): IVoicemail =>
  createVoicemailClient(webex, logger);

/**
 * .
 *
 * @param webex - A webex instance.
 * @param logger - Logger to set logger level.
 */
window.CreateContactsClient = (webex: WebexSDK, logger: LoggerConfig): IContacts =>
  createContactsClient(webex, logger);

/**
 * .
 *
 * @param webex - A webex instance.
 * @param logger - Logger to set logger level.
 */
window.CreateCallSettingsClient = (webex: WebexSDK, logger: LoggerConfig): ICallSettings =>
  createCallSettingsClient(webex, logger);


export {
  createClient,
  createCallHistoryClient,
  createVoicemailClient,
  createContactsClient,
  createCallSettingsClient,
};
