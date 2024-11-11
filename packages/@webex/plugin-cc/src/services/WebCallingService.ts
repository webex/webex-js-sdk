import {
  createClient,
  ICall,
  ICallingClient,
  ILine,
  LINE_EVENTS,
  CallingClientConfig,
} from '@webex/calling';
import {WebexSDK} from '../types';
import {TIMEOUT_DURATION} from '../constants';

export default class WebCallingService {
  private callingClient: ICallingClient;
  private callingClientConfig: CallingClientConfig;
  private line: ILine;
  private call: ICall;
  private webex: WebexSDK;
  constructor(webex: WebexSDK, callingClientConfig: CallingClientConfig) {
    this.webex = webex;
    this.callingClientConfig = callingClientConfig;
  }

  public async registerWebCallingLine(): Promise<void> {
    this.callingClient = await createClient(this.webex as any, this.callingClientConfig);
    this.line = Object.values(this.callingClient.getLines())[0];

    this.line.on(LINE_EVENTS.UNREGISTERED, () => {
      this.webex.logger.log(`WxCC-SDK: Desktop un registered successfully`);
    });

    // Start listening for incoming calls
    this.line.on(LINE_EVENTS.INCOMING_CALL, (callObj: ICall) => {
      this.call = callObj;

      const incomingCallEvent = new CustomEvent(LINE_EVENTS.INCOMING_CALL, {
        detail: {
          call: this.call,
        },
      });

      window.dispatchEvent(incomingCallEvent);
    });

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebCallingService Registration timed out'));
      }, TIMEOUT_DURATION);

      this.line.on(LINE_EVENTS.REGISTERED, (deviceInfo: ILine) => {
        clearTimeout(timeout);
        this.webex.logger.log(
          `WxCC-SDK: Desktop registered successfully, mobiusDeviceId: ${deviceInfo.mobiusDeviceId}`
        );
        resolve();
      });
      this.line.register();
    });
  }

  public async deregisterWebCallingLine() {
    this.line?.deregister();
  }
}
