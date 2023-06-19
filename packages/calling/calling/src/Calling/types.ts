import {CallingEventTypes} from '../Events/types';
import {ICallHistory} from '../CallHistory/types';
import {ICallSettings} from '../CallSettings/types';
import {CallingClientConfig, ICallingClient} from '../CallingClient/types';
import {IContacts} from '../Contacts/types';
import {LoggerConfig} from '../Logger/types';
import {ISDKConnector} from '../SDKConnector/types';
import {IVoicemail} from '../Voicemail/types';
import {Eventing} from '../Events/impl';

interface ClientConfig {
  calling?: boolean;
  contact?: boolean;
  history?: boolean;
  settings?: boolean;
  voicemail?: boolean;
}

export interface WebexConfig {
  access_token: string;
}

export interface CallingConfig {
  clientConfig: ClientConfig;
  callingClientConfig: CallingClientConfig;
  logger: LoggerConfig;
}

export interface ICalling extends Eventing<CallingEventTypes> {
  register: () => Promise<void>;
  callingClient: ICallingClient;
  contactClient: IContacts;
  callHistoryClient: ICallHistory;
  callSettingsClient: ICallSettings;
  voicemailClient: IVoicemail;
  getSDKConnector: () => ISDKConnector;
}
