/* eslint-disable tsdoc/syntax */
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {CallingConfig, ICalling, WebexConfig} from './types';
import {createClient} from '../CallingClient/CallingClient';
import {createContactsClient} from '../Contacts/ContactsClient';
import {createCallHistoryClient} from '../CallHistory/CallHistory';
import {createCallSettingsClient} from '../CallSettings/CallSettings';
import {createVoicemailClient} from '../Voicemail/Voicemail';
import {ICallingClient} from '../CallingClient/types';
import {IContacts} from '../Contacts/types';
import {ICallHistory} from '../CallHistory/types';
import {ICallSettings} from '../CallSettings/types';
import {IVoicemail} from '../Voicemail/types';
import SDKConnector from '../SDKConnector';
import {Webex} from '../init';
import {CallingEventTypes, EVENT_KEYS} from '../Events/types';
import {Eventing} from '../Events/impl';
import log from '../Logger';
import {CALLING_FILE} from '../CallingClient/constants';

/**
 *
 */
class Calling extends Eventing<CallingEventTypes> implements ICalling {
  private callingConfig: CallingConfig;

  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  public callingClient!: ICallingClient;

  public contactClient!: IContacts;

  public callHistoryClient!: ICallHistory;

  public callSettingsClient!: ICallSettings;

  public voicemailClient!: IVoicemail;

  /**
   *
   * @param callingConfig
   * @param webex
   * @param webexConfig
   */
  constructor(callingConfig: CallingConfig, webex?: WebexSDK, webexConfig?: WebexConfig) {
    super();
    this.sdkConnector = SDKConnector;
    this.callingConfig = callingConfig;
    if (!webex) {
      this.webex = Webex.init({
        credentials: {
          access_token: webexConfig?.access_token,
        },
      });

      this.webex.once('ready', () => {
        this.emit(EVENT_KEYS.READY);
      });
    } else {
      this.webex = webex;
      if (!this.sdkConnector.getWebex()) {
        SDKConnector.setWebex(this.webex);
      }

      this.initializeClients(callingConfig);
    }
    log.setLogger(callingConfig.logger.level);
  }

  /**
   *
   */
  public register() {
    const logContext = {
      file: CALLING_FILE,
      method: this.register.name,
    };

    return this.webex.internal.device
      .register()
      .then(() => {
        log.info('Authentication: webex.internal.device.register successful', logContext);

        return this.webex.internal.mercury
          .connect()
          .then(() => {
            log.info('Authentication: webex.internal.mercury.connect successful', logContext);
            if (!this.sdkConnector.getWebex()) {
              SDKConnector.setWebex(this.webex);
            }

            this.initializeClients(this.callingConfig);
          })
          .catch((error: unknown) => {
            log.warn(`Error occurred during mercury.connect():  ${error}`, logContext);
          });
      })
      .catch((error: unknown) => {
        log.warn(`Error occurred during mercury.register():  ${error}`, logContext);
      });
  }

  /**
   *
   * @param callingConfig
   */
  private initializeClients(callingConfig: CallingConfig) {
    const {clientConfig, logger} = callingConfig;

    if (clientConfig.calling) {
      this.callingClient = createClient(callingConfig.callingClientConfig);
    }

    if (clientConfig.contact) {
      this.contactClient = createContactsClient(logger);
    }

    if (clientConfig.history) {
      this.callHistoryClient = createCallHistoryClient(logger);
    }

    if (clientConfig.settings) {
      this.callSettingsClient = createCallSettingsClient(logger);
    }

    if (clientConfig.voicemail) {
      this.voicemailClient = createVoicemailClient(logger);
    }
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

/**
 *
 * @param callingConfig
 * @param webex
 * @param webexConfig
 */
export const createCalling = (
  callingConfig: CallingConfig,
  webex?: WebexSDK,
  webexConfig?: WebexConfig
): ICalling => new Calling(callingConfig, webex, webexConfig);
