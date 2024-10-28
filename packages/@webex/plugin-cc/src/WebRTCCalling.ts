import {
  createClient,
  ICall,
  ICallingClient,
  ILine,
  LINE_EVENTS,
  CALL_EVENT_KEYS,
} from '@webex/calling';
import {WebexSDK} from './types';

const TIMEOUT_DURATION = 20000; // 20 seconds timeout duration

export default class WebRTCCalling {
  private callingClient: ICallingClient;
  private callingClientConfig: any;
  private line: ILine;
  private call: ICall;
  private webex: WebexSDK;
  constructor(webex: WebexSDK, callingClientConfig: any) {
    this.webex = webex;
    this.callingClientConfig = callingClientConfig;
  }

  public async registerWebCallingLine() {
    this.callingClient = await createClient(this.webex as any, this.callingClientConfig);
    this.line = Object.values(this.callingClient.getLines())[0];

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Calling SDK Registration timed out'));
      }, TIMEOUT_DURATION);

      this.line.on(LINE_EVENTS.REGISTERED, (deviceInfo: any) => {
        clearTimeout(timeout);
        this.webex.logger.log(
          `WxCC-SDK: Desktop registered successfully, mobiusDeviceId: ${deviceInfo.mobiusDeviceId}`
        );
        resolve();
      });

      this.line.register();

      // Start listening for incoming calls
      this.line.on(LINE_EVENTS.INCOMING_CALL, (callObj: any) => {
        this.call = callObj;
        const incomingCallEvent = new CustomEvent('line:incoming_call', {
          detail: {
            call: this.call,
          },
        });

        window.dispatchEvent(incomingCallEvent);

        this.call.on(CALL_EVENT_KEYS.CALLER_ID, (CallerIdEmitter: any) => {
          this.webex.logger.log(
            `callerId : Name: ${CallerIdEmitter.callerId.name}, Number: ${CallerIdEmitter.callerId.number}, Avatar: ${CallerIdEmitter.callerId.avatarSrc}, UserId: ${CallerIdEmitter.callerId.id}`
          );
        });
      });
    });
  }

  public async deregisterWebCallingLine() {
    this.line.deregister();
  }
}
