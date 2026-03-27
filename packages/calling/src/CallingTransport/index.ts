/* eslint-disable class-methods-use-this */
import {WebexRequestPayload} from '../common/types';
import SDKConnector from '../SDKConnector';
import {WebexSDK} from '../SDKConnector/types';
import LegacyMercuryTransportAdapter from './LegacyMercuryTransportAdapter';
import {
  ICallingTransport,
  ICallingTransportAdapter,
  CallingTransportEventHandler,
  CallingTransportConnectionStateChangeHandler,
} from './types';

class CallingTransport implements ICallingTransport {
  private static transportAdapter: ICallingTransportAdapter = new LegacyMercuryTransportAdapter();

  public setAdapter(adapter: ICallingTransportAdapter): void {
    if (CallingTransport.transportAdapter === adapter) {
      return;
    }

    const webex = SDKConnector.getWebex();

    if (webex) {
      CallingTransport.transportAdapter.dispose?.(webex);
    }

    CallingTransport.transportAdapter = adapter;
  }

  public request<T>(request: WebexRequestPayload): Promise<T> {
    return CallingTransport.transportAdapter.request<T>(this.getRequiredWebex(), request);
  }

  public on<T>(event: string, handler: CallingTransportEventHandler<T>): void {
    CallingTransport.transportAdapter.on(this.getRequiredWebex(), event, handler);
  }

  public off<T>(event: string, handler?: CallingTransportEventHandler<T>): void {
    CallingTransport.transportAdapter.off(this.getRequiredWebex(), event, handler);
  }

  public onConnectionStateChange(handler: CallingTransportConnectionStateChangeHandler): void {
    CallingTransport.transportAdapter.onConnectionStateChange(this.getRequiredWebex(), handler);
  }

  public offConnectionStateChange(): void {
    CallingTransport.transportAdapter.offConnectionStateChange(this.getRequiredWebex());
  }

  private getRequiredWebex(): WebexSDK {
    const webex = SDKConnector.getWebex();

    if (!webex) {
      throw new Error('CallingTransport requires SDKConnector webex instance');
    }

    return webex;
  }
}

export default Object.freeze(new CallingTransport());
