import {
  createClient,
  ICall,
  ICallingClient,
  ILine,
  LINE_EVENTS,
  CALL_EVENT_KEYS,
  CallerIdDisplay,
} from '@webex/calling';
import {CallingClientConfig} from '@webex/calling/dist/types/CallingClient/types';
import {WebexSDK} from './types';
import {TIMEOUT_DURATION} from './constants';

export default class WebRTCCalling {
  private callingClient: ICallingClient;
  private callingClientConfig: CallingClientConfig;
  private line: ILine;
  private call: ICall;
  private webex: WebexSDK;
  constructor(webex: WebexSDK, callingClientConfig: CallingClientConfig) {
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

      this.line.on(LINE_EVENTS.REGISTERED, (deviceInfo: ILine) => {
        clearTimeout(timeout);
        this.webex.logger.log(
          `WxCC-SDK: Desktop registered successfully, mobiusDeviceId: ${deviceInfo.mobiusDeviceId}`
        );
        resolve();
      });

      this.line.register();

      // Start listening for incoming calls
      this.line.on(LINE_EVENTS.INCOMING_CALL, (callObj: ICall) => {
        this.call = callObj;

        this.call.on(CALL_EVENT_KEYS.CALLER_ID, (callerId: CallerIdDisplay) => {
          this.webex.logger.log(
            `callerId : Name: ${callerId.callerId.name}, Number: ${callerId.callerId.num}, Avatar: ${callerId.callerId.avatarSrc}, UserId: ${callerId.callerId.id}`
          );
        });

        const incomingCallEvent = new CustomEvent('line:incoming_call', {
          detail: {
            call: this.call,
          },
        });

        window.dispatchEvent(incomingCallEvent);
      });
    });
  }

  public async deregisterWebCallingLine() {
    return this.line.deregister();
  }
}
