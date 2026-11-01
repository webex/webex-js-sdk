import EventEmitter from 'events';
import {
  createClient,
  ICall,
  ICallingClient,
  ILine,
  LINE_EVENTS,
  ServiceIndicator,
  LocalMicrophoneStream,
  CALL_EVENT_KEYS,
  CALLING_CLIENT_EVENT_KEYS,
  MOBIUS_SOCKET_DISCONNECT_REASON,
  LOGGER,
  MobiusSocketDisconnectedEvent,
  LineError,
} from '@webex/calling';
import isEqual from 'lodash/isEqual';
import {
  LoginOption,
  VoiceConnectionState,
  VOICE_CONNECTION_STATUS,
  VoiceLineStatus,
  VoiceMobiusSocketStatus,
  WebexSDK,
} from '../types';
import {VOICE_CONNECTION_EVENTS} from './config/types';
import {
  DEFAULT_VOICE_CONNECTION_STATE,
  TIMEOUT_DURATION,
  WEB_CALLING_SERVICE_FILE,
} from '../constants';
import LoggerProxy from '../logger-proxy';
import {
  DEFAULT_RTMS_DOMAIN,
  ALLOWED_RTMS_DOMAIN,
  POST_AUTH,
  WCC_CALLING_RTMS_DOMAIN,
  DEREGISTER_WEBCALLING_LINE_MSG,
  METHODS,
} from './constants';
import {isAllowedUrlHost} from './core/Utils';

// Match RegistrationStatus.ACTIVE; @webex/calling does not export the enum from its public barrel.
const ACTIVE_REGISTRATION_STATUS = 'active' as LineError['status'];

/**
 * WebCallingService provides WebRTC calling functionality for Contact Center agents.
 * It handles registration, call management, and media operations for voice interactions.
 * @internal
 */
export default class WebCallingService extends EventEmitter {
  /**
   * The CallingClient instance that manages WebRTC calling capabilities
   * @private
   */
  private callingClient: ICallingClient;

  /**
   * The Line instance that handles registration and incoming calls
   * @private
   */
  private line: ILine;

  /**
   * The current active call instance
   * @private
   */
  private call: ICall | undefined;

  /**
   * Reference to the WebexSDK instance
   * @private
   */
  private webex: WebexSDK;

  /**
   * The login option selected for this session
   * @private
   */
  public loginOption: LoginOption;

  private browserVoiceRequired = false;

  private voiceConnectionState: VoiceConnectionState = {...DEFAULT_VOICE_CONNECTION_STATE};

  private lineReason?: string;

  private lineRetryable?: boolean;

  private socketReason?: string;

  private socketRetryable?: boolean;

  private rejectRegistration?: (error: Error) => void;

  private registrationCompleteHandler?: (line: ILine) => void;

  private incomingCallHandler?: (call: ICall) => void;

  private registrationGeneration = 0;

  private registrationListenerCleanup: Array<() => void> = [];

  /**
   * Map that associates call IDs with task IDs for correlation
   * @private
   */
  private callTaskMap: Map<string, string>;

  /**
   * Creates an instance of WebCallingService.
   * @param {WebexSDK} webex - The Webex SDK instance
   */
  constructor(webex: WebexSDK) {
    super();
    this.webex = webex;
    this.callTaskMap = new Map();
  }

  /**
   * Sets the login option for the current session
   * @param {LoginOption} loginOption - The login option to use
   * @private
   */
  public setLoginOption(loginOption: LoginOption): void {
    this.loginOption = loginOption;
  }

  /** Sets whether the current local login registers a browser voice line. */
  public setBrowserVoiceRequired(required: boolean): void {
    this.browserVoiceRequired = required;
    this.updateVoiceConnectionState({});
  }

  /**
   * Returns a copy of the latest browser voice state.
   * @returns {VoiceConnectionState} Current voice availability and transport states
   * @public
   */
  public getVoiceConnectionState(): VoiceConnectionState {
    return {...this.voiceConnectionState};
  }

  /**
   * Reports whether the browser line is ready for voice interactions.
   * @returns {boolean} True when browser voice is ready
   * @private
   */
  public isVoiceReady(): boolean {
    return this.voiceConnectionState.status === VOICE_CONNECTION_STATUS.READY;
  }

  /**
   * Reports whether this login requires browser voice registration.
   * @returns {boolean} True when browser WebRTC is enabled for the current login
   * @private
   */
  public isBrowserVoiceRequired(): boolean {
    return this.browserVoiceRequired;
  }

  private isLineReady(lineStatus = this.voiceConnectionState.lineStatus): boolean {
    return lineStatus === VoiceLineStatus.REGISTERED || lineStatus === VoiceLineStatus.RECONNECTED;
  }

  private updateVoiceConnectionState(
    update: Partial<Pick<VoiceConnectionState, 'lineStatus' | 'mobiusSocketStatus'>>
  ): void {
    const lineStatus = update.lineStatus ?? this.voiceConnectionState.lineStatus;
    const mobiusSocketStatus =
      update.mobiusSocketStatus ?? this.voiceConnectionState.mobiusSocketStatus;
    let status = VOICE_CONNECTION_STATUS.UNAVAILABLE;

    if (!this.browserVoiceRequired) {
      status = VOICE_CONNECTION_STATUS.NOT_REQUIRED;
    } else if (
      this.isLineReady(lineStatus) &&
      mobiusSocketStatus !== VoiceMobiusSocketStatus.DISCONNECTED
    ) {
      status = VOICE_CONNECTION_STATUS.READY;
    }
    const reason =
      mobiusSocketStatus === VoiceMobiusSocketStatus.DISCONNECTED
        ? this.socketReason
        : this.lineReason;
    const retryable =
      mobiusSocketStatus === VoiceMobiusSocketStatus.DISCONNECTED
        ? this.socketRetryable
        : this.lineRetryable;
    const nextState: VoiceConnectionState = {
      status,
      lineStatus,
      mobiusSocketStatus,
      ...(reason ? {reason} : {}),
      ...(retryable !== undefined ? {retryable} : {}),
    };

    if (isEqual(nextState, this.voiceConnectionState)) {
      return;
    }

    this.voiceConnectionState = nextState;
    this.emit(VOICE_CONNECTION_EVENTS.STATE_CHANGE, this.getVoiceConnectionState());
  }

  private addRegistrationListener(
    emitter: ICallingClient | ILine,
    event: string,
    callback: (...args: any[]) => void
  ): (...args: any[]) => void {
    const generation = this.registrationGeneration;
    const listener = (...args: any[]) => {
      if (generation === this.registrationGeneration) {
        callback(...args);
      }
    };

    (emitter as any).on(event, listener);
    this.registrationListenerCleanup.push(() => (emitter as any).off?.(event, listener));

    return listener;
  }

  private async cleanupWebCallingRegistration(): Promise<void> {
    this.registrationGeneration += 1;
    this.rejectRegistration?.(new Error('WebCallingService registration superseded'));
    this.rejectRegistration = undefined;
    this.registrationListenerCleanup.forEach((cleanup) => cleanup());
    this.registrationListenerCleanup = [];
    this.incomingCallHandler = undefined;
    this.registrationCompleteHandler = undefined;

    const line = this.line;
    this.line = undefined;
    this.callingClient = undefined;
    if (line) {
      await line.deregister();
    }
  }

  private handleLineConnecting = (): void => {
    this.lineReason = undefined;
    this.lineRetryable = undefined;
    this.updateVoiceConnectionState({lineStatus: VoiceLineStatus.CONNECTING});
  };

  private handleLineRegistered = (line: ILine): void => {
    this.lineReason = undefined;
    this.lineRetryable = undefined;
    this.updateVoiceConnectionState({lineStatus: VoiceLineStatus.REGISTERED});
    LoggerProxy.log(
      `WxCC-SDK: Desktop registered successfully, mobiusDeviceId: ${line.mobiusDeviceId}`,
      {module: WEB_CALLING_SERVICE_FILE, method: METHODS.REGISTER_WEB_CALLING_LINE}
    );
  };

  private handleLineReconnecting = (): void => {
    this.lineReason = 'LINE_RECONNECTING';
    this.lineRetryable = true;
    this.updateVoiceConnectionState({lineStatus: VoiceLineStatus.RECONNECTING});
  };

  private handleLineReconnected = (): void => {
    this.lineReason = undefined;
    this.lineRetryable = undefined;
    this.updateVoiceConnectionState({lineStatus: VoiceLineStatus.RECONNECTED});
  };

  private handleLineUnregistered = (): void => {
    this.lineReason = 'LINE_UNREGISTERED';
    this.lineRetryable = true;
    this.updateVoiceConnectionState({lineStatus: VoiceLineStatus.UNREGISTERED});
    LoggerProxy.log(`WxCC-SDK: Desktop unregistered successfully`, {
      module: WEB_CALLING_SERVICE_FILE,
      method: METHODS.REGISTER_WEB_CALLING_LINE,
    });
  };

  private handleLineError = (error: LineError): void => {
    if (error.status !== ACTIVE_REGISTRATION_STATUS) {
      this.lineReason = error.message || 'LINE_ERROR';
      this.lineRetryable = false;
      this.updateVoiceConnectionState({lineStatus: VoiceLineStatus.ERROR});
      this.rejectRegistration?.(error);
    }
  };

  private handleMobiusSocketConnected = (): void => {
    this.socketReason = undefined;
    this.socketRetryable = undefined;
    this.updateVoiceConnectionState({mobiusSocketStatus: VoiceMobiusSocketStatus.CONNECTED});
  };

  private handleMobiusSocketDisconnected = (event: MobiusSocketDisconnectedEvent): void => {
    this.socketReason = `MOBIUS_SOCKET_${event.reason.toUpperCase()}`;
    this.socketRetryable = event.reason === MOBIUS_SOCKET_DISCONNECT_REASON.TRANSIENT;
    this.updateVoiceConnectionState({mobiusSocketStatus: VoiceMobiusSocketStatus.DISCONNECTED});
  };

  /**
   * Handles remote media track events from the call
   * @param {MediaStreamTrack} track - The media track received
   * @private
   */
  private handleMediaEvent = (track: MediaStreamTrack): void => {
    this.emit(CALL_EVENT_KEYS.REMOTE_MEDIA, track);
  };

  /**
   * Handles disconnect events from the call
   * @private
   */
  private handleDisconnectEvent = (): void => {
    this.call.end();
    this.cleanUpCall();
  };

  /**
   * Registers event listeners for the current call
   * @private
   */
  private registerCallListeners(): void {
    // TODO: Add remaining call listeners here
    this.call.on(CALL_EVENT_KEYS.REMOTE_MEDIA, this.handleMediaEvent);
    this.call.on(CALL_EVENT_KEYS.DISCONNECT, this.handleDisconnectEvent);
  }

  /**
   * Cleans up resources associated with the current call
   * Removes event listeners and clears the call-task mapping
   * @private
   */
  public cleanUpCall(): void {
    if (this.call) {
      this.call.off(CALL_EVENT_KEYS.REMOTE_MEDIA, this.handleMediaEvent);
      this.call.off(CALL_EVENT_KEYS.DISCONNECT, this.handleDisconnectEvent);
      const callId = this.call.getCallId();
      const taskId = this.getTaskIdForCall(callId);

      if (taskId) {
        this.callTaskMap.delete(callId);
      }
      this.call = null;
    }
  }

  /**
   * Retrieves the RTMS domain to use for WebRTC connections
   * First tries to get it from the service catalog, then falls back to default
   * @private
   * @returns {Promise<string>} The RTMS domain to use
   */
  private async getRTMSDomain(): Promise<string> {
    await this.webex.internal.services.waitForCatalog(POST_AUTH);

    const rtmsURL = this.webex.internal.services.get(WCC_CALLING_RTMS_DOMAIN);

    try {
      const hostname = new URL(rtmsURL).hostname.toLowerCase();

      if (!isAllowedUrlHost(rtmsURL, [ALLOWED_RTMS_DOMAIN])) {
        LoggerProxy.error(
          `Non-allow-listed RTMS host from u2c catalogue: ${hostname} so falling back to default domain`,
          {
            module: WEB_CALLING_SERVICE_FILE,
            method: METHODS.GET_RTMS_DOMAIN,
          }
        );

        return DEFAULT_RTMS_DOMAIN;
      }

      return hostname;
    } catch (error) {
      LoggerProxy.error(
        `Invalid URL from u2c catalogue: ${rtmsURL} so falling back to default domain`,
        {
          module: WEB_CALLING_SERVICE_FILE,
          method: METHODS.GET_RTMS_DOMAIN,
        }
      );

      return DEFAULT_RTMS_DOMAIN;
    }
  }

  /**
   * Registers the WebCalling line for receiving calls
   * Sets up event listeners for line events and initializes the calling client
   *
   * @private
   * @returns {Promise<void>} A promise that resolves when registration is complete
   * @throws {Error} When registration times out
   */
  public async registerWebCallingLine(): Promise<void> {
    const registrationGeneration = this.registrationGeneration + 1;
    await this.cleanupWebCallingRegistration();
    if (registrationGeneration !== this.registrationGeneration) {
      return;
    }

    this.lineReason = undefined;
    this.lineRetryable = undefined;
    this.updateVoiceConnectionState({lineStatus: VoiceLineStatus.CONNECTING});

    try {
      const rtmsDomain = await this.getRTMSDomain(); // get the RTMS domain from the u2c catalogue
      if (registrationGeneration !== this.registrationGeneration) {
        return;
      }

      const callingClientConfig = {
        logger: {
          level: LOGGER.INFO,
        },
        serviceData: {
          indicator: ServiceIndicator.CONTACT_CENTER,
          domain: rtmsDomain,
        },
      };

      const callingClient = await createClient(this.webex as any, callingClientConfig);
      if (registrationGeneration !== this.registrationGeneration) {
        await Object.values(callingClient.getLines())[0]?.deregister();

        return;
      }
      this.callingClient = callingClient;
      this.line = Object.values(this.callingClient.getLines())[0];
      this.updateVoiceConnectionState({
        mobiusSocketStatus: this.callingClient.isMobiusSocketConnected()
          ? VoiceMobiusSocketStatus.CONNECTED
          : VoiceMobiusSocketStatus.NOT_IN_USE,
      });

      this.addRegistrationListener(
        this.callingClient,
        CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_CONNECTED,
        this.handleMobiusSocketConnected
      );
      this.addRegistrationListener(
        this.callingClient,
        CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_DISCONNECTED,
        this.handleMobiusSocketDisconnected
      );

      this.addRegistrationListener(this.line, LINE_EVENTS.CONNECTING, this.handleLineConnecting);
      this.addRegistrationListener(
        this.line,
        LINE_EVENTS.RECONNECTING,
        this.handleLineReconnecting
      );
      this.addRegistrationListener(this.line, LINE_EVENTS.RECONNECTED, this.handleLineReconnected);
      this.addRegistrationListener(
        this.line,
        LINE_EVENTS.UNREGISTERED,
        this.handleLineUnregistered
      );
      this.addRegistrationListener(this.line, LINE_EVENTS.ERROR, this.handleLineError);

      // Start listening for incoming calls
      this.incomingCallHandler = this.addRegistrationListener(
        this.line,
        LINE_EVENTS.INCOMING_CALL,
        (call: ICall) => {
          this.call = call;
          this.emit(LINE_EVENTS.INCOMING_CALL, call);
        }
      );

      await new Promise<void>((resolve, reject) => {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const finish = (): void => {
          if (timeout) {
            clearTimeout(timeout);
          }
          this.rejectRegistration = undefined;
          if (this.registrationCompleteHandler) {
            this.line.off(LINE_EVENTS.REGISTERED, this.registrationCompleteHandler);
            this.registrationCompleteHandler = undefined;
          }
        };
        this.rejectRegistration = (error: Error): void => {
          finish();
          reject(error);
        };
        timeout = setTimeout(() => {
          this.lineReason = 'REGISTRATION_TIMEOUT';
          this.lineRetryable = true;
          this.updateVoiceConnectionState({lineStatus: VoiceLineStatus.ERROR});
          this.rejectRegistration?.(new Error('WebCallingService Registration timed out'));
        }, TIMEOUT_DURATION);

        this.addRegistrationListener(this.line, LINE_EVENTS.REGISTERED, this.handleLineRegistered);
        this.registrationCompleteHandler = this.addRegistrationListener(
          this.line,
          LINE_EVENTS.REGISTERED,
          () => {
            finish();
            resolve();
          }
        );

        // ILine declares register() as void, although its implementation is async.
        Promise.resolve(this.line.register()).catch((error: LineError) => {
          this.handleLineError(error);
        });
      });
    } catch (error) {
      if (registrationGeneration !== this.registrationGeneration) {
        return;
      }
      if (this.voiceConnectionState.lineStatus !== VoiceLineStatus.ERROR) {
        this.lineReason =
          this.lineReason ?? (error instanceof Error ? error.message : 'REGISTRATION_FAILED');
        this.lineRetryable = false;
        this.updateVoiceConnectionState({lineStatus: VoiceLineStatus.ERROR});
      }
      throw error;
    }
  }

  /**
   * Deregisters the WebCalling line
   * Cleans up any active calls and deregisters from the calling service
   *
   * @private
   * @returns {Promise<void>} A promise that resolves when deregistration is complete
   */
  public async deregisterWebCallingLine(): Promise<void> {
    LoggerProxy.log(DEREGISTER_WEBCALLING_LINE_MSG, {
      module: WEB_CALLING_SERVICE_FILE,
      method: METHODS.DEREGISTER_WEB_CALLING_LINE,
    });
    this.cleanUpCall();
    await this.cleanupWebCallingRegistration();
    this.lineReason = undefined;
    this.lineRetryable = undefined;
    this.socketReason = undefined;
    this.socketRetryable = undefined;
    this.browserVoiceRequired = false;
    const defaultState: VoiceConnectionState = {...DEFAULT_VOICE_CONNECTION_STATE};

    if (!isEqual(defaultState, this.voiceConnectionState)) {
      this.voiceConnectionState = defaultState;
      this.emit(VOICE_CONNECTION_EVENTS.STATE_CHANGE, this.getVoiceConnectionState());
    }
  }

  /**
   * Answers an incoming call with the provided audio stream
   *
   * @private
   * @param {LocalMicrophoneStream} localAudioStream - The local microphone stream to use
   * @param {string} taskId - The task ID associated with this call
   * @throws {Error} If answering the call fails
   */
  public answerCall(localAudioStream: LocalMicrophoneStream, taskId: string): void {
    if (this.call) {
      try {
        LoggerProxy.info(`Call answered: ${taskId}`, {
          module: WEB_CALLING_SERVICE_FILE,
          method: METHODS.ANSWER_CALL,
        });
        this.call.answer(localAudioStream);
        this.registerCallListeners();
      } catch (error) {
        LoggerProxy.error(`Failed to answer call for ${taskId}. Error: ${error}`, {
          module: WEB_CALLING_SERVICE_FILE,
          method: METHODS.ANSWER_CALL,
        });
        // Optionally, throw the error to allow the invoker to handle it
        throw error;
      }
    } else {
      LoggerProxy.log(`Cannot answer a non WebRtc Call: ${taskId}`, {
        module: WEB_CALLING_SERVICE_FILE,
        method: METHODS.ANSWER_CALL,
      });
    }
  }

  /**
   * Toggles the mute state of the current call
   *
   * @private
   * @param {LocalMicrophoneStream} localAudioStream - The local microphone stream to control
   */
  public muteUnmuteCall(localAudioStream: LocalMicrophoneStream): void {
    if (this.call) {
      LoggerProxy.info('Call mute or unmute requested!', {
        module: WEB_CALLING_SERVICE_FILE,
        method: METHODS.MUTE_UNMUTE_CALL,
      });
      this.call.mute(localAudioStream);
    } else {
      LoggerProxy.log(`Cannot mute a non WebRtc Call`, {
        module: WEB_CALLING_SERVICE_FILE,
        method: METHODS.MUTE_UNMUTE_CALL,
      });
    }
  }

  /**
   * Checks if the current call is muted
   *
   * @private
   * @returns {boolean} True if the call is muted, false otherwise or if no call exists
   */
  public isCallMuted(): boolean {
    if (this.call) {
      return this.call.isMuted();
    }

    return false;
  }

  /**
   * Declines or ends the current call
   *
   * @private
   * @param {string} taskId - The task ID associated with this call
   * @throws {Error} If ending the call fails
   */
  public declineCall(taskId: string): void {
    if (this.call) {
      try {
        LoggerProxy.info(`Call end requested: ${taskId}`, {
          module: WEB_CALLING_SERVICE_FILE,
          method: METHODS.DECLINE_CALL,
        });
        this.call.end();
        this.cleanUpCall();
      } catch (error) {
        LoggerProxy.error(`Failed to end call: ${taskId}. Error: ${error}`, {
          module: WEB_CALLING_SERVICE_FILE,
          method: METHODS.DECLINE_CALL,
        });
        // Optionally, throw the error to allow the invoker to handle it
        throw error;
      }
    } else {
      LoggerProxy.log(`Cannot end a non WebRtc Call: ${taskId}`, {
        module: WEB_CALLING_SERVICE_FILE,
        method: METHODS.DECLINE_CALL,
      });
    }
  }

  /**
   * Maps a call ID to a task ID for correlation
   *
   * @private
   * @param {string} callId - The unique call identifier
   * @param {string} taskId - The associated task identifier
   */
  public mapCallToTask(callId: string, taskId: string): void {
    this.callTaskMap.set(callId, taskId);
  }

  /**
   * Gets the task ID associated with a call ID
   *
   * @private
   * @param {string} callId - The call ID to look up
   * @returns {string|undefined} The associated task ID or undefined if not found
   */
  public getTaskIdForCall(callId: string): string | undefined {
    return this.callTaskMap.get(callId);
  }
}
