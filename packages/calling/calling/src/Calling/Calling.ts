import {ISDKConnector, WebexSDK} from "../SDKConnector/types";
import {CallingConfig, ICalling} from "./types";
import {createClient} from "../CallingClient/CallingClient";
import {createContactsClient} from "../Contacts/ContactsClient";
import {createCallHistoryClient} from "../CallHistory/CallHistory";
import {createCallSettingsClient} from "../CallSettings/CallSettings";
import {createVoicemailClient} from "../Voicemail/Voicemail";
import {ICallingClient} from "../CallingClient/types";
import {IContacts} from "../Contacts/types";
import {ICallHistory} from "../CallHistory/types";
import {ICallSettings} from "../CallSettings/types";
import {IVoicemail} from "../Voicemail/types";
import {initializeWebex} from "../init";
import SDKConnector from "../SDKConnector";

export class Calling implements ICalling {
  private sdkConnector: ISDKConnector;
  private webex: WebexSDK;
  private callingClient!: ICallingClient;
  private contactClient!: IContacts;
  private callHistoryClient!: ICallHistory;
  private callSettingsClient!: ICallSettings;
  private voicemailClient!: IVoicemail;

  constructor(callingConfig: CallingConfig, webex?: WebexSDK) {
    if (!webex) {
      this.webex = initializeWebex(callingConfig.webexConfig?.token)
    } else {
      this.webex = webex;
    }

    this.sdkConnector = SDKConnector;

    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(this.webex);
    }

    if (callingConfig.clientConfig.calling) {
      this.callingClient = createClient(callingConfig.callingClientConfig);
    }

    if (callingConfig.clientConfig.contact) {
      this.contactClient = createContactsClient(callingConfig.logger);
    }

    if (callingConfig.clientConfig.history) {
      this.callHistoryClient = createCallHistoryClient(callingConfig.logger);
    }

    if (callingConfig.clientConfig.settings) {
      this.callSettingsClient = createCallSettingsClient(callingConfig.logger);
    }

    if (callingConfig.clientConfig.voicemail) {
      this.voicemailClient = createVoicemailClient(callingConfig.logger);
    }
  };

  /**
   * Function to return CallingClient object.
   *
   * @returns CallingClient.
   */
  public getCallingClient(): ICallingClient {
    return this.callingClient;
  }

  /**
   * Function to return ContactClient object.
   *
   * @returns ContactClient.
   */
  public getContactClient(): IContacts {
    return this.contactClient;
  }

  /**
   * Function to return CallHistorytClient object.
   *
   * @returns CallHistoryClient.
   */
  public getCallHistoryClient(): ICallHistory {
    return this.callHistoryClient;
  }

  /**
   * Function to return CallSettingsClient object.
   *
   * @returns CallSettingsClient.
   */
  public getCallSettingsClient(): ICallSettings {
    return this.callSettingsClient;
  }

  /**
   * Function to return VoicemailClient object.
   *
   * @returns VoicemailClient.
   */
  public getVoicemailClient(): IVoicemail {
    return this.voicemailClient;
  }

  /**
   * Function to return SDKConnector object.
   *
   * @returns SDKConnector.
   */
  public getSDKConnector(): ISDKConnector {
    return this.sdkConnector;
  }
}

export const createCalling = (callingConfig: CallingConfig, webex?: WebexSDK): ICalling => new Calling(callingConfig, webex);

