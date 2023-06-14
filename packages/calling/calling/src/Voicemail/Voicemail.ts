/* eslint-disable dot-notation */
/* eslint-disable no-underscore-dangle */
import SDKConnector from '../SDKConnector';
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {
  IVoicemail,
  CALLING_BACKEND,
  VoicemailResponseEvent,
  CallingPartyInfo,
} from './types';
import log from '../Logger';
import {getCallingBackEnd} from '../common/Utils';
import {WxCallBackendConnector} from './WxCallBackendConnector';
import {BroadworksBackendConnector} from './BroadworksBackendConnector';
import {DisplayInformation, SORT} from '../common/types';
import {VoicemailEventTypes} from '../Events/types';
import {Eventing} from '../Events/impl';
import {UcmBackendConnector} from './UcmBackendConnector';
import {LoggerConfig} from '../Calling/types';
/**
 *
 */
export class Voicemail extends Eventing<VoicemailEventTypes> implements IVoicemail {
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  private callingBackend: CALLING_BACKEND;

  private backendConnector!: IVoicemail;

  /**
   * @param logger -.
   */
  constructor(public logger: LoggerConfig) {
    super();
    this.sdkConnector = SDKConnector;
    this.webex = this.sdkConnector.getWebex();
    this.callingBackend = getCallingBackEnd(this.webex);
    this.initializeBackendConnector();
    log.setLogger(logger.level);
  }

  /**
   * Voicemail connector initialization.
   *
   * @returns Response.
   */
  public init() {
    const response = this.backendConnector.init();

    return response;
  }

  /**
   * Setup and initialize the voicemail backend connector class object.
   */
  private initializeBackendConnector() {
    switch (this.callingBackend) {
      case CALLING_BACKEND.WXC: {
        this.backendConnector = new WxCallBackendConnector(this.webex, this.logger);
        break;
      }

      case CALLING_BACKEND.BWRKS: {
        this.backendConnector = new BroadworksBackendConnector(this.webex, this.logger);
        break;
      }

      case CALLING_BACKEND.UCM: {
        this.backendConnector = new UcmBackendConnector(this.webex, this.logger);
        break;
      }

      default: {
        throw new Error('Calling backend is not identified, exiting....');
      }
    }
  }

  /**
   * Call voicemail class to fetch the voicemail lists.
   *
   * @param sort - Sort voicemail list (ASC | DESC). TODO: Once we start implementing sorting.
   * @param offset - Number of records to skip.
   * @param offsetLimit - Number of voicemail list to fetch from the offset.
   * @param refresh - Refresh the list of voicemails from backend.
   * @returns Promise.
   */
  public async getVoicemailList(
    offset: number,
    offsetLimit: number,
    sort: SORT,
    refresh?: boolean
  ): Promise<VoicemailResponseEvent> {
    const response = await this.backendConnector.getVoicemailList(
      offset,
      offsetLimit,
      sort,
      refresh
    );

    return response;
  }

  /**
   * Fetch the voicemail contents for the messageId.
   *
   * @param messageId - String result from the voicemail list.
   * @returns Promise.
   */
  public async getVoicemailContent(messageId: string): Promise<VoicemailResponseEvent> {
    const response = await this.backendConnector.getVoicemailContent(messageId);

    return response;
  }

  /**
   * Fetch voicemail read message status for the messageId.
   *
   * @param messageId -string result from the voicemail list.
   * @returns Promise.
   */
  public async voicemailMarkAsRead(messageId: string): Promise<VoicemailResponseEvent> {
    const response = await this.backendConnector.voicemailMarkAsRead(messageId);

    return response;
  }

  /**
   * Fetch voicemail unread status for the messageId.
   *
   * @param messageId -string result from the voicemail list.
   * @returns Promise.
   */
  public async voicemailMarkAsUnread(messageId: string): Promise<VoicemailResponseEvent> {
    const response = await this.backendConnector.voicemailMarkAsUnread(messageId);

    return response;
  }

  /**
   * Fetch voicemail delete status for the messageId.
   *
   * @param messageId -string result from the voicemail list.
   * @returns Promise.
   */
  public async deleteVoicemail(messageId: string): Promise<VoicemailResponseEvent> {
    const response = await this.backendConnector.deleteVoicemail(messageId);

    return response;
  }

  /**
   * Fetch the voicemail transcripts for the messageId.
   *
   * @param messageId - MessageId for which we need the transcript.
   * @returns Promise.
   */
  public async getVMTranscript(messageId: string): Promise<VoicemailResponseEvent | null> {
    const response = await this.backendConnector.getVMTranscript(messageId);

    return response;
  }

  /**
   * Resolve the Contact from userId or display name.
   *
   * @param callingPartyInfo - Calling Party Info.
   */
  public resolveContact(callingPartyInfo: CallingPartyInfo): Promise<DisplayInformation | null> {
    return this.backendConnector.resolveContact(callingPartyInfo);
  }

  /**
   * SDK connector function.
   *
   * @returns SdkConnector.
   */
  public getSDKConnector(): ISDKConnector {
    return this.sdkConnector;
  }
}

/**
 * @param webex -.
 * @param logger -.
 */
export const createVoicemailClient = (logger: LoggerConfig): IVoicemail =>
  new Voicemail(logger);
