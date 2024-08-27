import {Mutex} from 'async-mutex';
import {v4 as uuid} from 'uuid';
import {
  CallDetails,
  CallDirection,
  CorrelationId,
  IDeviceInfo,
  MobiusDeviceId,
  RegistrationStatus,
  ServiceData,
  ServiceIndicator,
} from '../../common/types';
import {ILine, LINE_EVENTS} from './types';
import {LINE_FILE, VALID_PHONE} from '../constants';
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
import {LINE_EVENT_KEYS, LineEventTypes} from '../../Events/types';
import {ICall, ICallManager} from '../calling/types';
import {getCallManager} from '../calling/callManager';
import {ERROR_TYPE} from '../../Errors/types';

let SERVICE_DATA: ServiceData = {indicator: ServiceIndicator.CALLING, domain: ''};

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

  public sipAddresses: string[] = [];

  public voicemail?: string;

  public lastSeen?: string;

  public keepaliveInterval?: number;

  public callKeepaliveInterval?: number;

  public rehomingIntervalMin?: number;

  public rehomingIntervalMax?: number;

  public voicePortalNumber?: number;

  public voicePortalExtension?: number;

  private callManager: ICallManager;

  #primaryMobiusUris: string[];

  #backupMobiusUris: string[];

  constructor(
    userId: string,
    clientDeviceUri: string,
    mutex: Mutex,
    primaryMobiusUris: string[],
    backupMobiusUris: string[],
    logLevel: LOGGER,
    serviceDataConfig?: CallingClientConfig['serviceData'],
    jwe?: string,
    phoneNumber?: string,
    extension?: string,
    voicemail?: string
  ) {
    super();
    this.lineId = uuid();
    this.userId = userId;
    this.clientDeviceUri = clientDeviceUri;
    this.phoneNumber = phoneNumber;
    this.extension = extension;
    this.voicemail = voicemail;

    this.#sdkConnector = SDKConnector;
    this.#webex = this.#sdkConnector.getWebex();
    this.#mutex = mutex;

    this.#primaryMobiusUris = primaryMobiusUris;
    this.#backupMobiusUris = backupMobiusUris;

    SERVICE_DATA = serviceDataConfig?.indicator ? serviceDataConfig : SERVICE_DATA;

    validateServiceData(SERVICE_DATA);

    this.registration = createRegistration(
      this.#webex,
      SERVICE_DATA,
      this.#mutex,
      this.lineEmitter,
      logLevel,
      jwe
    );

    log.setLogger(logLevel, LINE_FILE);

    this.callManager = getCallManager(this.#webex, SERVICE_DATA.indicator);

    this.incomingCallListener();
  }

  /**
   * Wrapper to for device registration.
   */
  public async register() {
    await this.#mutex.runExclusive(async () => {
      this.emit(LINE_EVENTS.CONNECTING);

      this.registration.setMobiusServers(this.#primaryMobiusUris, this.#backupMobiusUris);
      await this.registration.triggerRegistration();
    });
    if (this.mobiusDeviceId) {
      this.callManager.updateLine(this.mobiusDeviceId, this);
    }
  }

  /**
   * Wrapper to for device  deregister.
   */
  public async deregister() {
    await this.registration.deregister();
    this.registration.setStatus(RegistrationStatus.IDLE);
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
    this.sipAddresses = device?.addresses ?? [];
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
  public getStatus = (): RegistrationStatus => this.registration.getStatus();

  /**
   * Gets device id
   */
  public getDeviceId = (): MobiusDeviceId | undefined =>
    this.registration.getDeviceInfo().device?.deviceId;

  /**
   * Initiates a call to the specified destination.
   * @param dest - The call details including destination information.
   */
  public makeCall = (dest?: CallDetails): ICall | undefined => {
    let call;

    if (dest) {
      const match = dest.address.match(VALID_PHONE);

      if (match && match[0].length === dest.address.length) {
        const sanitizedNumber = dest.address
          .replace(/[^[*+]\d#]/gi, '')
          .replace(/\s+/gi, '')
          .replace(/-/gi, '');
        const formattedDest = {
          type: dest.type,
          address: `tel:${sanitizedNumber}`,
        };

        call = this.callManager.createCall(
          CallDirection.OUTBOUND,
          this.registration.getDeviceInfo().device?.deviceId as string,
          this.lineId,
          formattedDest
        );
        log.log(`New call created, callId: ${call.getCallId()}`, {});
      } else {
        log.warn('Invalid phone number detected', {});

        const err = new LineError(
          'An invalid phone number was detected. Check the number and try again.',
          {},
          ERROR_TYPE.CALL_ERROR,
          RegistrationStatus.ACTIVE
        );

        this.emit(LINE_EVENTS.ERROR, err);
      }

      return call;
    }
    if (SERVICE_DATA.indicator === ServiceIndicator.GUEST_CALLING) {
      call = this.callManager.createCall(
        CallDirection.OUTBOUND,
        this.registration.getDeviceInfo().device?.deviceId as string,
        this.lineId
      );
      log.log(`New guest call created, callId: ${call.getCallId()}`, {});

      return call;
    }

    return undefined;
  };

  /**
   * An Incoming Call listener.
   */
  private incomingCallListener() {
    const logContext = {
      file: LINE_FILE,
      method: this.incomingCallListener.name,
    };
    log.log('Listening for incoming calls... ', logContext);
    this.callManager.on(LINE_EVENT_KEYS.INCOMING_CALL, (callObj: ICall) => {
      this.emit(LINE_EVENTS.INCOMING_CALL, callObj);
    });
  }

  /**
   * @param callId -.
   * @param correlationId -.
   */
  public getCall = (correlationId: CorrelationId): ICall => {
    return this.callManager.getCall(correlationId);
  };
}
