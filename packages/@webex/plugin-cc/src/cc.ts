/* eslint-disable no-console */
import {WebexPlugin} from '@webex/webex-core';
import {CCPluginConfig, IContactCenter, WebexSDK, CC_EVENTS, WebSocketEvent} from './types';
import {EVENT, READY, WEBSOCKET_EVENT_TIMEOUT, SUBSCRIBE_API, WCC_API_GATEWAY} from './constants';
import IWebSocket from './WebSocket/IWebSocket';
import WebSocket from './WebSocket/WebSocket';

const REGISTER_EVENT = 'register';

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  namespace = 'ContactCenter';
  $config: CCPluginConfig;
  $webex: WebexSDK;
  wccApiUrl: string;
  webSocket: IWebSocket;
  ciUserId: string;
  registered = false;
  eventHandlers: Map<
    string,
    {resolve: (data: any) => void; reject: (error: any) => void; timeoutId: NodeJS.Timeout}
  > = new Map();

  constructor(...args) {
    super(...args);
    // @ts-ignore
    this.$config = this.config;
    // @ts-ignore
    this.$webex = this.webex;

    this.$webex.once(READY, () => {
      this.webSocket = new WebSocket({
        parent: this.$webex,
      });
    });
  }

  /**
   * This is used for making the CC SDK ready by setting up the cc mercury connection.
   * @param success
   */
  public register(): Promise<string> {
    this.wccApiUrl = this.$webex.internal.services.get(WCC_API_GATEWAY);

    this.listenForWebSocketEvents();

    return new Promise((resolve, reject) => {
      this.addEventHandler(
        REGISTER_EVENT,
        (result) => {
          this.registered = true;
          resolve(result);
        },
        reject
      );

      this.establishConnection();
    });
  }

  /**
   * This is used for unregistering the CC SDK by disconnecting the cc mercury connection.
   * @returns Promise<void>
   */
  public unregister(): Promise<void> {
    return this.webSocket.disconnectWebSocket().then(() => {
      this.webSocket.off(EVENT, this.processEvent);
      this.registered = false;
    });
  }

  private listenForWebSocketEvents() {
    this.webSocket.on(EVENT, this.processEvent);
  }

  private processEvent = (event: WebSocketEvent): void => {
    switch (event.type) {
      case CC_EVENTS.WELCOME:
        this.ciUserId = event.data.agentId;
        this.handleEvent(REGISTER_EVENT, `Success: CI User ID is ${this.ciUserId}`); // TODO: Will send AgentPRofile object as part of Parv's PR
        break;
    }
  };

  private async establishConnection(): Promise<void> {
    const datachannelUrl = `${this.wccApiUrl}${SUBSCRIBE_API}`;

    const connectionConfig = {
      force: this.$config?.force ?? true,
      isKeepAliveEnabled: this.$config?.isKeepAliveEnabled ?? false,
      clientType: this.$config?.clientType ?? 'WxCCSDK',
      allowMultiLogin: this.$config?.allowMultiLogin ?? true,
    };

    this.webSocket.subscribeAndConnect({
      datachannelUrl,
      body: connectionConfig,
    });
  }

  private handleEvent(eventName: string, result: any) {
    const handler = this.eventHandlers.get(eventName);
    if (handler) {
      clearTimeout(handler.timeoutId);
      handler.resolve(result);
      this.eventHandlers.delete(eventName);
    }
  }

  private addEventHandler(
    eventName: string,
    resolve: (data: any) => void,
    reject: (error: any) => void
  ) {
    this.eventHandlers.set(eventName, {
      resolve,
      reject,
      timeoutId: setTimeout(() => {
        reject(new Error(`Time out waiting for event: ${eventName}`));
        this.eventHandlers.delete(eventName);
      }, WEBSOCKET_EVENT_TIMEOUT),
    });
  }
}
