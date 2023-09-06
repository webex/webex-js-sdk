import {Mutex} from 'async-mutex';
import {v4 as uuid} from 'uuid';
import {IDeviceInfo, MobiusDeviceId, MobiusStatus, ServiceIndicator} from '../../common/types';
import {ILine, LINE_EVENTS, LineEventTypes, LineStatus} from './types';
import {LINE_FILE} from '../constants';
import log from '../../Logger';
import {IRegistration} from '../registration/types';
import {createRegistration} from '../registration';
import {ISDKConnector, WebexSDK} from '../../SDKConnector/types';
import {CallingClientConfig} from '../types';
import {Eventing} from '../../Events/impl';
import {LineError} from '../../Errors/catalog/LineError';
import {LOGGER} from '../../Logger/types';
import {validateServiceData} from '../../common';
import SDKConnector from '../../SDKConnector';

export default class Line extends Eventing<LineEventTypes> implements ILine {
  #webex: WebexSDK;

  #mutex: Mutex;

  #sdkConnector: ISDKConnector;

  public registration: IRegistration;

  public userId: string;

  public clientDeviceUri: string;

  public lineId: string;

  public mobiusDeviceId?: string;

  private mobiusUri?: string;

  public phoneNumber?: string;

  public extension?: string;

  public status: LineStatus;

  public sipAddresses?: string[];

  public voicemail?: string;

  public lastSeen?: string;

  public keepaliveInterval?: number;

  public callKeepaliveInterval?: number;

  public rehomingIntervalMin?: number;

  public rehomingIntervalMax?: number;

  public voicePortalNumber?: number;

  public voicePortalExtension?: number;

  #primaryMobiusUris: string[];

  #backupMobiusUris: string[];

  constructor(
    userId: string,
    clientDeviceUri: string,
    status: LineStatus,
    mutex: Mutex,
    primaryMobiusUris: string[],
    backupMobiusUris: string[],
    logLevel: LOGGER,
    serviceDataConfig?: CallingClientConfig['serviceData'],
    phoneNumber?: string,
    extension?: string,
    voicemail?: string
  ) {
    super();
    this.lineId = uuid();
    this.userId = userId;
    this.clientDeviceUri = clientDeviceUri;
    this.status = status;
    this.phoneNumber = phoneNumber;
    this.extension = extension;
    this.voicemail = voicemail;

    this.#sdkConnector = SDKConnector;
    this.#webex = this.#sdkConnector.getWebex();
    this.#mutex = mutex;

    this.#primaryMobiusUris = primaryMobiusUris;
    this.#backupMobiusUris = backupMobiusUris;

    const serviceData = serviceDataConfig?.indicator
      ? serviceDataConfig
      : {indicator: ServiceIndicator.CALLING, domain: ''};

    validateServiceData(serviceData);

    this.registration = createRegistration(
      this.#webex,
      serviceData,
      this.#mutex,
      this.lineEmitter,
      logLevel
    );

    this.registration.setStatus(MobiusStatus.DEFAULT);
    log.setLogger(logLevel, LINE_FILE);
  }

  /**
   * Wrapper to for device registration.
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
   * To normalize line class with Mobius response
   */
  private normalizeLine(deviceInfo: IDeviceInfo) {
    const {
      device,
      keepaliveInterval,
      callKeepaliveInterval,
      rehomingIntervalMin,
      rehomingIntervalMax,
      voicePortalNumber,
      voicePortalExtension,
    } = deviceInfo;

    this.mobiusDeviceId = device?.deviceId;
    this.mobiusUri = device?.uri;
    this.lastSeen = device?.lastSeen;
    this.sipAddresses = device?.addresses;
    this.keepaliveInterval = keepaliveInterval;
    this.callKeepaliveInterval = callKeepaliveInterval;
    this.rehomingIntervalMin = rehomingIntervalMin;
    this.rehomingIntervalMax = rehomingIntervalMax;
    this.voicePortalNumber = voicePortalNumber;
    this.voicePortalExtension = voicePortalExtension;
  }

  /**
   * Line events emitter
   */
  public lineEmitter = (event: LINE_EVENTS, deviceInfo?: IDeviceInfo, lineError?: LineError) => {
    switch (event) {
      case LINE_EVENTS.REGISTERED:
        if (deviceInfo) {
          this.normalizeLine(deviceInfo);
          this.emit(event, this);
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
   * To get the current log Level.
   */
  public getLoggingLevel(): LOGGER {
    return log.getLogLevel();
  }

  /**
   *  To get active url of Mobius.
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
