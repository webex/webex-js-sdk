import { ICallHistory } from "../CallHistory/types";
import { ICallSettings } from "../CallSettings/types";
import {CallingClientConfig, ICallingClient} from "../CallingClient/types";
import { IContacts } from "../Contacts/types";
import {LOGGER} from "../Logger/types";
import { ISDKConnector } from "../SDKConnector/types";
import { IVoicemail } from "../Voicemail/types";

interface ClientConfig {
  calling?: boolean;
  contact?: boolean;
  history?: boolean;
  settings?: boolean;
  voicemail?: boolean;
}

export interface LoggerConfig {
  level: LOGGER;
}

interface WebexConfig {
  token: string;
}

export interface CallingConfig {
  clientConfig: ClientConfig;
  callingClientConfig: CallingClientConfig;
  logger: LoggerConfig;
  webexConfig?: WebexConfig;
}

export interface ICalling {
  getCallingClient: () => ICallingClient;
  getContactClient: () => IContacts;
  getCallHistoryClient: () => ICallHistory;
  getCallSettingsClient: () => ICallSettings;
  getVoicemailClient: () => IVoicemail;
  getSDKConnector: () => ISDKConnector;
}

