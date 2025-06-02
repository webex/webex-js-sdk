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
  LOGGER,
} from '@webex/calling';
import {LoginOption, WebexSDK} from '../types';
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

    this.line.on(LINE_EVENTS.UNREGISTERED, () => {
      LoggerProxy.log(`WxCC-SDK: Desktop unregistered successfully`, {
        module: WEB_CALLING_SERVICE_FILE,
        method: METHODS.REGISTER_WEB_CALLING_LINE,
      });
    });

    // Start listening for incoming calls
    this.line.on(LINE_EVENTS.INCOMING_CALL, (call: ICall) => {
      this.call = call;
      this.emit(LINE_EVENTS.INCOMING_CALL, call);
    });

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebCallingService Registration timed out'));
      }, TIMEOUT_DURATION);

      this.line.on(LINE_EVENTS.REGISTERED, (deviceInfo: ILine) => {
        clearTimeout(timeout);
        LoggerProxy.log(
          `WxCC-SDK: Desktop registered successfully, mobiusDeviceId: ${deviceInfo.mobiusDeviceId}`,
          {module: WEB_CALLING_SERVICE_FILE, method: METHODS.REGISTER_WEB_CALLING_LINE}
        );
        resolve();
      });
      this.line.register();
    });
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
