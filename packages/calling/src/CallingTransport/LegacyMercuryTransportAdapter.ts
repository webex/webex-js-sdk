/* eslint-disable class-methods-use-this */
import {
  ICallingTransportAdapter,
  CallingTransportEventHandler,
  CallingTransportConnectionStateChangeHandler,
  CallingTransportConnectionSource,
  CallingTransportConnectionState,
} from './types';
import {WebexRequestPayload} from '../common/types';
import {WebexSDK} from '../SDKConnector/types';

export default class LegacyMercuryTransportAdapter implements ICallingTransportAdapter {
  private offlineHandler?: () => void;

  private onlineHandler?: () => void;

  public request<T>(webex: WebexSDK, request: WebexRequestPayload): Promise<T> {
    return webex.request(request);
  }

  public on<T>(webex: WebexSDK, event: string, handler: CallingTransportEventHandler<T>): void {
    webex.internal.mercury.on(event, handler as (...args: unknown[]) => void);
  }

  public off<T>(webex: WebexSDK, event: string, handler?: CallingTransportEventHandler<T>): void {
    if (handler) {
      webex.internal.mercury.off(event, handler as (...args: unknown[]) => void);

      return;
    }

    webex.internal.mercury.off(event);
  }

  public onConnectionStateChange(
    webex: WebexSDK,
    handler: CallingTransportConnectionStateChangeHandler
  ): void {
    this.offlineHandler = () => {
      handler({
        source: CallingTransportConnectionSource.MERCURY,
        state: CallingTransportConnectionState.OFFLINE,
      });
    };

    this.onlineHandler = () => {
      handler({
        source: CallingTransportConnectionSource.MERCURY,
        state: CallingTransportConnectionState.ONLINE,
      });
    };

    webex.internal.mercury.on('offline', this.offlineHandler);
    webex.internal.mercury.on('online', this.onlineHandler);
  }

  public offConnectionStateChange(webex: WebexSDK): void {
    if (this.offlineHandler) {
      webex.internal.mercury.off('offline', this.offlineHandler);
    }
    if (this.onlineHandler) {
      webex.internal.mercury.off('online', this.onlineHandler);
    }
    this.offlineHandler = undefined;
    this.onlineHandler = undefined;
  }
}
