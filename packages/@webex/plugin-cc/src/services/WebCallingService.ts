import EventEmitter from 'events';
import {
  createClient,
  ICall,
  ICallingClient,
  ILine,
  LINE_EVENTS,
  CallingClientConfig,
  LocalMicrophoneStream,
  CALL_EVENT_KEYS,
} from '@webex/calling';
import {LoginOption, WebexSDK} from '../types';
import {TIMEOUT_DURATION, WEB_CALLING_SERVICE_FILE} from '../constants';
import LoggerProxy from '../logger-proxy';

export default class WebCallingService extends EventEmitter {
  private callingClient: ICallingClient;
  private callingClientConfig: CallingClientConfig;
  private line: ILine;
  private call: ICall;
  private webex: WebexSDK;
  public loginOption: LoginOption;
  constructor(webex: WebexSDK, callingClientConfig: CallingClientConfig) {
    super();
    this.webex = webex;
    this.callingClientConfig = callingClientConfig;
  }

  public setLoginOption(loginOption: LoginOption) {
    this.loginOption = loginOption;
  }

  private handleMediaEvent = (track: MediaStreamTrack) => {
    this.emit(CALL_EVENT_KEYS.REMOTE_MEDIA, track);
  };

  private registerCallListeners() {
    // TODO: Add remaining call listeners here
    this.call.on(CALL_EVENT_KEYS.REMOTE_MEDIA, this.handleMediaEvent);
  }

  public unregisterCallListeners() {
    // TODO: Once we handle disconnect or call end, switch off the call listeners
    this.call.off(CALL_EVENT_KEYS.REMOTE_MEDIA, this.handleMediaEvent);
  }

  public async registerWebCallingLine(): Promise<void> {
    this.callingClient = await createClient(this.webex as any, this.callingClientConfig);
    this.line = Object.values(this.callingClient.getLines())[0];

    this.line.on(LINE_EVENTS.UNREGISTERED, () => {
      LoggerProxy.log(`WxCC-SDK: Desktop unregistered successfully`, {
        module: WEB_CALLING_SERVICE_FILE,
        method: this.registerWebCallingLine.name,
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
          {module: WEB_CALLING_SERVICE_FILE, method: this.registerWebCallingLine.name}
        );
        resolve();
      });
      this.line.register();
    });
  }

  public async deregisterWebCallingLine() {
    this.line?.deregister();
  }

  public answerCall(localAudioStream: LocalMicrophoneStream, taskId: string) {
    if (this.call) {
      try {
        this.webex.logger.info(`Call answered: ${taskId}`);
        this.call.answer(localAudioStream);
        this.registerCallListeners();
      } catch (error) {
        this.webex.logger.error(`Failed to answer call for ${taskId}. Error: ${error}`);
        // Optionally, throw the error to allow the invoker to handle it
        throw error;
      }
    } else {
      this.webex.logger.log(`Cannot answer a non WebRtc Call: ${taskId}`);
    }
  }

  public muteCall(localAudioStream: LocalMicrophoneStream) {
    if (this.call) {
      this.webex.logger.info('Call mute or unmute requested!');
      this.call.mute(localAudioStream);
    } else {
      this.webex.logger.log(`Cannot mute a non WebRtc Call`);
    }
  }

  public isCallMuted() {
    if (this.call) {
      return this.call.isMuted();
    }

    return false;
  }

  public declineCall(taskId: string) {
    if (this.call) {
      try {
        this.webex.logger.info(`Call end requested: ${taskId}`);
        this.call.end();
        this.unregisterCallListeners();
      } catch (error) {
        this.webex.logger.error(`Failed to end call: ${taskId}. Error: ${error}`);
        // Optionally, throw the error to allow the invoker to handle it
        throw error;
      }
    } else {
      this.webex.logger.log(`Cannot end a non WebRtc Call: ${taskId}`);
    }
  }
}
