/* eslint-disable valid-jsdoc */
import {getMobiusSocketInstance} from '@webex/internal-plugin-mobius-socket';
import {WebexRequestPayload} from '../common/types';
import {ISDKConnector, WebexSDK} from './types';
/* eslint-disable class-methods-use-this */
import {validateWebex} from './utils';
// @ts-ignore - JS module without type declarations

let instance: ISDKConnector;
let webex: WebexSDK;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mobiusSocket: any;

/**
 *
 */
class SDKConnector implements ISDKConnector {
  /**
   * @param webexInstance - TODO.
   */
  public setWebex(webexInstance: WebexSDK): void {
    if (instance) {
      throw new Error('You cannot set the SDKConnector instance more than once'); // TODO: format log messages and customize Error Object
    }
    const {error, success} = validateWebex(webexInstance);

    if (error) {
      throw error;
    } else if (success) {
      webex = webexInstance; // TODO: Object.freeze to prevent changes? That might break the reference chain though
      mobiusSocket = getMobiusSocketInstance(webexInstance);
    } else {
      throw new Error('An unknown error occurred setting up the webex instance.');
    }

    /* eslint-disable @typescript-eslint/no-this-alias */
    instance = this;
  }

  /**
   *
   */
  public get(): ISDKConnector {
    return instance;
  }

  /**
   *
   */
  public getWebex(): WebexSDK {
    return webex;
  }

  /**
   * @param request - TODO.
   */
  public request<T>(request: WebexRequestPayload): Promise<T> {
    return instance.getWebex().request(request);
  }

  /**
   * @param event - TODO.
   * @param cb - TODO.
   */
  public registerListener<T>(event: string, cb: (data?: T) => void): void {
    instance.getWebex().internal.mercury.on(event, (data: T) => {
      cb(data);
    });
  }

  /**
   * @param event - TODO.
   */
  public unregisterListener(event: string): void {
    instance.getWebex().internal.mercury.off(event);
  }

  /**
   * @param event - TODO.
   * @param cb - TODO.
   */
  public registerMobiusSocketListener<T>(event: string, cb: (data?: T) => void): void {
    if (!mobiusSocket) {
      mobiusSocket = getMobiusSocketInstance(instance.getWebex());
    }
    mobiusSocket.on(event, (data: T) => {
      cb(data);
    });
  }

  /**
   * @param event - TODO.
   */
  public unregisterMobiusSocketListener(event: string): void {
    if (!mobiusSocket) {
      mobiusSocket = getMobiusSocketInstance(instance.getWebex());
    }
    mobiusSocket.off(event);
  }
}

export default Object.freeze(new SDKConnector()); // TODO: remove freeze?
