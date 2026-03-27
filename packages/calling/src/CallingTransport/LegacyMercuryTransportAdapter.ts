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

type ConnectionStateHandlerRegistry = {
  handlers: Set<CallingTransportConnectionStateChangeHandler>;
  mercuryOfflineListener: () => void;
  mercuryOnlineListener: () => void;
};

export default class LegacyMercuryTransportAdapter implements ICallingTransportAdapter {
  private readonly connectionStateHandlers = new WeakMap<
    WebexSDK,
    ConnectionStateHandlerRegistry
  >();

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
    let registry = this.connectionStateHandlers.get(webex);

    if (!registry) {
      const handlers = new Set<CallingTransportConnectionStateChangeHandler>();

      registry = {
        handlers,
        mercuryOfflineListener: () => {
          handlers.forEach((registeredHandler) => {
            registeredHandler({
              source: CallingTransportConnectionSource.MERCURY,
              state: CallingTransportConnectionState.OFFLINE,
            });
          });
        },
        mercuryOnlineListener: () => {
          handlers.forEach((registeredHandler) => {
            registeredHandler({
              source: CallingTransportConnectionSource.MERCURY,
              state: CallingTransportConnectionState.ONLINE,
            });
          });
        },
      };

      this.connectionStateHandlers.set(webex, registry);
      webex.internal.mercury.on('offline', registry.mercuryOfflineListener);
      webex.internal.mercury.on('online', registry.mercuryOnlineListener);
    }

    registry.handlers.add(handler);
  }

  public offConnectionStateChange(
    webex: WebexSDK,
    handler?: CallingTransportConnectionStateChangeHandler
  ): void {
    const registry = this.connectionStateHandlers.get(webex);

    if (!registry) {
      return;
    }

    if (handler) {
      registry.handlers.delete(handler);
    } else {
      registry.handlers.clear();
    }

    if (registry.handlers.size === 0) {
      webex.internal.mercury.off('offline', registry.mercuryOfflineListener);
      webex.internal.mercury.off('online', registry.mercuryOnlineListener);
      this.connectionStateHandlers.delete(webex);
    }
  }
}
