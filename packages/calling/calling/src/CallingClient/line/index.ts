import {Mutex} from 'async-mutex';
import {v4 as uuid} from 'uuid';
import {ILineInfo, MobiusDeviceId, MobiusStatus, ServiceIndicator} from '../../common/types';
import {ILine, LINE_EVENTS, LineEventTypes, LineStatus} from './types';
import {LINE_FILE, KEEPALIVE_UTIL} from '../constants';
import log from '../../Logger';
import {IRegistration} from '../registration/types';
import {createRegistration} from '../registration';
import {ISDKConnector, WebexSDK} from '../../SDKConnector/types';
import {SdkConfig} from '../types';
import {Eventing} from '../../Events/impl';
import {LineError} from '../../Errors/catalog/LineError';
import {LOGGER} from '../../Logger/types';
import {validateServiceData} from '../../common';
import SDKConnector from '../../SDKConnector';
import {EVENT_KEYS} from '../../Events/types';
import {CallingClientError} from '../../Errors';

export default class Line extends Eventing<LineEventTypes> implements ILine {
  #webex: WebexSDK;

  #mutex: Mutex;

  #sdkConfig: SdkConfig | undefined;

  #sdkConnector: ISDKConnector;

  public registration: IRegistration;

  public userId: string;

  public clientDeviceUri: string;

  public lineId: string;

  public mobiusDeviceId: string | undefined;

  public phoneNumber: string | undefined;

  public extension: string | undefined;

  public status: LineStatus;

  public sipAddresses: string[] | undefined;

  public voicemail: string | undefined;

  public lastSeen: string | undefined;

  public keepaliveInterval: number | undefined;

  public callKeepaliveInterval: number | undefined;

  public rehomingIntervalMin: number | undefined;

  public rehomingIntervalMax: number | undefined;

  public voicePortalNumber: number | undefined;

  public voicePortalExtension: number | undefined;

  #primaryMobiusUris: string[];

  #backupMobiusUris: string[];

  constructor(
    userId: string,
    clientDeviceUri: string,
    status: LineStatus,
    mutex: Mutex,
    config: SdkConfig | undefined,
    primaryMobiusUris: string[],
    backupMobiusUris: string[],
    callingClientEmitter: (event: EVENT_KEYS, clientError?: CallingClientError) => void,
    mobiusDeviceId?: string,
    phoneNumber?: string,
    extension?: string,
    sipAddresses?: string[],
    voicemail?: string,
    lastSeen?: string,
    keepaliveInterval?: number,
    callKeepaliveInterval?: number,
    rehomingIntervalMin?: number,
    rehomingIntervalMax?: number,
    voicePortalNumber?: number,
    voicePortalExtension?: number
  ) {
    super();
    this.userId = userId;
    this.clientDeviceUri = clientDeviceUri;
    this.lineId = uuid();
    this.mobiusDeviceId = mobiusDeviceId;
    this.phoneNumber = phoneNumber;
    this.extension = extension;
    this.status = status;
    this.sipAddresses = sipAddresses;
    this.voicemail = voicemail;
    this.lastSeen = lastSeen;
    this.keepaliveInterval = keepaliveInterval;
    this.callKeepaliveInterval = callKeepaliveInterval;
    this.rehomingIntervalMin = rehomingIntervalMin;
    this.rehomingIntervalMax = rehomingIntervalMax;
    this.voicePortalNumber = voicePortalNumber;
    this.voicePortalExtension = voicePortalExtension;

    this.#sdkConnector = SDKConnector;
    this.#webex = this.#sdkConnector.getWebex();
    this.#mutex = mutex;

    this.#primaryMobiusUris = primaryMobiusUris;
    this.#backupMobiusUris = backupMobiusUris;

    this.#sdkConfig = config;
    const serviceData = this.#sdkConfig?.serviceData?.indicator
      ? this.#sdkConfig.serviceData
      : {indicator: ServiceIndicator.CALLING, domain: ''};

    const logLevel = this.#sdkConfig?.logger?.level ? this.#sdkConfig.logger.level : LOGGER.ERROR;
    validateServiceData(serviceData);

    this.registration = createRegistration(
      this.#webex,
      serviceData,
      this.#mutex,
      this.lineEmitter,
      callingClientEmitter,
      logLevel
    );

    this.registration.setStatus(MobiusStatus.DEFAULT);
    log.setLogger(logLevel, LINE_FILE);
  }

  /**
   * Wrapper to for device registration.
   *
   * @param retry - Retry in case of errors.
   */
  public async register() {
    await this.#mutex.runExclusive(async () => {
      this.registration.setStatus(MobiusStatus.DEFAULT);
      this.emit(LINE_EVENTS.CONNECTING);

      this.registration.setMobiusServers(this.#primaryMobiusUris, this.#backupMobiusUris);
      await this.registration.triggerRegistration();
    });
  }

  /**
   * Wrapper to for device  deregister.
   */
  public async deregister() {
    this.registration.deregister();
  }

  /**
   * Request for the Device status.
   *
   * @param lineInfo - Registered device Object.
   * @returns Promise.
   */
  public async sendKeepAlive(lineInfo: ILineInfo): Promise<void> {
    const deviceId = lineInfo.device?.deviceId as string;
    const interval = lineInfo.keepaliveInterval as number;
    const url = lineInfo.device?.uri as string;

    const logContext = {
      file: LINE_FILE,
      method: KEEPALIVE_UTIL,
    };

    this.registration.clearKeepaliveTimer();

    log.info(
      `Fetched details :-> deviceId: ${deviceId}, interval :-> ${interval}, url: ${url}`,
      logContext
    );

    if (this.registration.isDeviceRegistered()) {
      this.registration.startKeepaliveTimer(url, interval);
    } else {
      log.warn('Device is not active, exiting.', logContext);
    }
  }

  /**
   * Line events emitter
   */
  public lineEmitter = (event: LINE_EVENTS, lineInfo?: ILineInfo, lineError?: LineError) => {
    switch (event) {
      case LINE_EVENTS.REGISTERED:
        if (lineInfo) {
          this.emit(event, lineInfo);
        }
        break;
      case LINE_EVENTS.UNREGISTERED:
      case LINE_EVENTS.RECONNECTED:
      case LINE_EVENTS.RECONNECTING:
        this.emit(event);
        break;
      case LINE_EVENTS.ERROR:
        if (lineError) {
          this.emit(event, lineError);
        }
        break;
      default:
        break;
    }
  };

  /**
   *  Returns active url.
   *
   * @returns Url - Active url of Mobius.
   */
  public getActiveMobiusUrl(): string {
    return this.registration.getActiveMobiusUrl();
  }

  /**
   * Gets registration status
   */
  public getRegistrationStatus = (): MobiusStatus => this.registration.getStatus();

  /**
   * Gets device id
   */
  public getDeviceId = (): MobiusDeviceId | undefined =>
    this.registration.getDeviceInfo().device?.deviceId;
}
