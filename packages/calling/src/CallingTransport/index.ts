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

let transportAdapter: ICallingTransportAdapter = new LegacyMercuryTransportAdapter();

class CallingTransport implements ICallingTransport {
  public setAdapter(adapter: ICallingTransportAdapter): void {
    transportAdapter = adapter;
  }

  public request<T>(request: WebexRequestPayload): Promise<T> {
    return transportAdapter.request<T>(this.getRequiredWebex(), request);
  }

  public on<T>(event: string, handler: CallingTransportEventHandler<T>): void {
    transportAdapter.on(this.getRequiredWebex(), event, handler);
  }

  public off<T>(event: string, handler?: CallingTransportEventHandler<T>): void {
    transportAdapter.off(this.getRequiredWebex(), event, handler);
  }

  public onConnectionStateChange(handler: CallingTransportConnectionStateChangeHandler): void {
    transportAdapter.onConnectionStateChange(this.getRequiredWebex(), handler);
  }

  public offConnectionStateChange(): void {
    transportAdapter.offConnectionStateChange(this.getRequiredWebex());
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
