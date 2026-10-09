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
} from '@webex/calling';
import {
  LoginOption,
  VoiceConnectionState,
  VOICE_CONNECTION_EVENTS,
  VOICE_CONNECTION_STATUS,
  WebexSDK,
} from '../types';
import {TIMEOUT_DURATION, WEB_CALLING_SERVICE_FILE} from '../constants';
import LoggerProxy from '../logger-proxy';
import {
  DEFAULT_RTMS_DOMAIN,
  POST_AUTH,
  WCC_CALLING_RTMS_DOMAIN,
  DEREGISTER_WEBCALLING_LINE_MSG,
  METHODS,
} from './constants';

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

  private voiceConnectionState: VoiceConnectionState = {
    status: VOICE_CONNECTION_STATUS.NOT_REQUIRED,
    lineStatus: 'unknown',
    mobiusSocketStatus: 'unknown',
  };

  private rejectRegistration?: (error: Error) => void;

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
  public setLoginOption(
    loginOption: LoginOption,
    browserVoiceRequired: boolean = loginOption === LoginOption.BROWSER
  ): void {
    this.loginOption = loginOption;
    this.browserVoiceRequired = loginOption === LoginOption.BROWSER && browserVoiceRequired;
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

  private updateVoiceConnectionState(update: Partial<Omit<VoiceConnectionState, 'status'>>): void {
    const lineStatus = update.lineStatus ?? this.voiceConnectionState.lineStatus;
    const mobiusSocketStatus =
      update.mobiusSocketStatus ?? this.voiceConnectionState.mobiusSocketStatus;
    const reason = Object.prototype.hasOwnProperty.call(update, 'reason')
      ? update.reason
      : this.voiceConnectionState.reason;
    const retryable = Object.prototype.hasOwnProperty.call(update, 'retryable')
      ? update.retryable
      : this.voiceConnectionState.retryable;
    const lineReady = lineStatus === 'registered' || lineStatus === 'reconnected';
    let status = VOICE_CONNECTION_STATUS.UNAVAILABLE;

    if (!this.browserVoiceRequired) {
      status = VOICE_CONNECTION_STATUS.NOT_REQUIRED;
    } else if (lineReady && mobiusSocketStatus !== 'disconnected') {
      status = VOICE_CONNECTION_STATUS.READY;
    }
    const nextState: VoiceConnectionState = {
      status,
      lineStatus,
      mobiusSocketStatus,
      ...(reason ? {reason} : {}),
      ...(retryable !== undefined ? {retryable} : {}),
    };

    if (
      nextState.status === this.voiceConnectionState.status &&
      nextState.lineStatus === this.voiceConnectionState.lineStatus &&
      nextState.mobiusSocketStatus === this.voiceConnectionState.mobiusSocketStatus &&
      nextState.reason === this.voiceConnectionState.reason &&
      nextState.retryable === this.voiceConnectionState.retryable
    ) {
      return;
    }

    this.voiceConnectionState = nextState;
    this.emit(VOICE_CONNECTION_EVENTS.STATE_CHANGE, this.getVoiceConnectionState());
  }

  private handleLineConnecting = (): void => {
    this.updateVoiceConnectionState({
      lineStatus: 'connecting',
      reason: undefined,
      retryable: undefined,
    });
  };

  private handleLineRegistered = (line: ILine): void => {
    this.updateVoiceConnectionState({
      lineStatus: 'registered',
      reason: undefined,
      retryable: undefined,
    });
    LoggerProxy.log(
      `WxCC-SDK: Desktop registered successfully, mobiusDeviceId: ${line.mobiusDeviceId}`,
      {module: WEB_CALLING_SERVICE_FILE, method: METHODS.REGISTER_WEB_CALLING_LINE}
    );
  };

  private handleLineReconnecting = (): void => {
    this.updateVoiceConnectionState({
      lineStatus: 'reconnecting',
      reason: 'LINE_RECONNECTING',
      retryable: true,
    });
  };

  private handleLineReconnected = (): void => {
    this.updateVoiceConnectionState({
      lineStatus: 'reconnected',
      reason: undefined,
      retryable: undefined,
    });
  };

  private handleLineUnregistered = (): void => {
    this.updateVoiceConnectionState({
      lineStatus: 'unregistered',
      reason: 'LINE_UNREGISTERED',
      retryable: false,
    });
    LoggerProxy.log(`WxCC-SDK: Desktop unregistered successfully`, {
      module: WEB_CALLING_SERVICE_FILE,
      method: METHODS.REGISTER_WEB_CALLING_LINE,
    });
  };

  private handleLineError = (error: Error): void => {
    this.updateVoiceConnectionState({
      lineStatus: 'error',
      reason: error?.message || 'LINE_ERROR',
      retryable: undefined,
    });
    this.rejectRegistration?.(error instanceof Error ? error : new Error('LINE_ERROR'));
  };

  private handleMobiusSocketConnected = (): void => {
    this.updateVoiceConnectionState({
      mobiusSocketStatus: 'connected',
      ...(this.voiceConnectionState.lineStatus === 'registered' ||
      this.voiceConnectionState.lineStatus === 'reconnected'
        ? {reason: undefined, retryable: undefined}
        : {}),
    });
  };

  private handleMobiusSocketDisconnected = (event: MobiusSocketDisconnectedEvent): void => {
    this.updateVoiceConnectionState({
      mobiusSocketStatus: 'disconnected',
      reason: `MOBIUS_SOCKET_${event.reason.toUpperCase()}`,
      retryable: event.reason === MOBIUS_SOCKET_DISCONNECT_REASON.TRANSIENT,
    });
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
      const url = new URL(rtmsURL);

      return url.hostname;
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
    this.updateVoiceConnectionState({
      lineStatus: 'connecting',
      reason: undefined,
      retryable: undefined,
    });

    try {
      const rtmsDomain = await this.getRTMSDomain(); // get the RTMS domain from the u2c catalogue

      const callingClientConfig = {
        logger: {
          level: LOGGER.INFO,
        },
        serviceData: {
          indicator: ServiceIndicator.CONTACT_CENTER,
          domain: rtmsDomain,
        },
      };

      this.callingClient = await createClient(this.webex as any, callingClientConfig);
      this.line = Object.values(this.callingClient.getLines())[0];
      this.updateVoiceConnectionState({
        mobiusSocketStatus: this.callingClient.isMobiusSocketConnected()
          ? 'connected'
          : 'not-in-use',
      });

      this.callingClient.on(
        CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_CONNECTED,
        this.handleMobiusSocketConnected
      );
      this.callingClient.on(
        CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_DISCONNECTED,
        this.handleMobiusSocketDisconnected
      );

      this.line.on(LINE_EVENTS.CONNECTING, this.handleLineConnecting);
      this.line.on(LINE_EVENTS.RECONNECTING, this.handleLineReconnecting);
      this.line.on(LINE_EVENTS.RECONNECTED, this.handleLineReconnected);
      this.line.on(LINE_EVENTS.UNREGISTERED, this.handleLineUnregistered);
      this.line.on(LINE_EVENTS.ERROR, this.handleLineError);

      // Start listening for incoming calls
      this.line.on(LINE_EVENTS.INCOMING_CALL, (call: ICall) => {
        this.call = call;
        this.emit(LINE_EVENTS.INCOMING_CALL, call);
      });

      await new Promise<void>((resolve, reject) => {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const finish = (): void => {
          if (timeout) {
            clearTimeout(timeout);
          }
          this.rejectRegistration = undefined;
        };
        this.rejectRegistration = (error: Error): void => {
          finish();
          reject(error);
        };
        timeout = setTimeout(() => {
          this.updateVoiceConnectionState({
            lineStatus: 'error',
            reason: 'REGISTRATION_TIMEOUT',
            retryable: true,
          });
          this.rejectRegistration?.(new Error('WebCallingService Registration timed out'));
        }, TIMEOUT_DURATION);

        this.line.on(LINE_EVENTS.REGISTERED, (line: ILine) => {
          finish();
          this.handleLineRegistered(line);
          resolve();
        });

        Promise.resolve(this.line.register()).catch((error: Error) => {
          this.handleLineError(error);
        });
      });
    } catch (error) {
      this.updateVoiceConnectionState({
        lineStatus: 'error',
        reason:
          this.voiceConnectionState.reason ??
          (error instanceof Error ? error.message : 'REGISTRATION_FAILED'),
      });
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
    this.updateVoiceConnectionState({
      lineStatus: 'unregistered',
      reason: 'LINE_UNREGISTERED',
      retryable: false,
    });
    this.callingClient?.off(
      CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_CONNECTED,
      this.handleMobiusSocketConnected
    );
    this.callingClient?.off(
      CALLING_CLIENT_EVENT_KEYS.MOBIUS_SOCKET_DISCONNECTED,
      this.handleMobiusSocketDisconnected
    );
    this.line?.deregister();
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
