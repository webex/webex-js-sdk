/* eslint-disable no-console */
import {WebexPlugin} from '@webex/webex-core';
import {CCPluginConfig, IContactCenter, WebexSDK, CC_EVENTS} from './types';
import {EVENT, READY, WEBSOCKET_EVENT_TIMEOUT, SUBSCRIBE_API, WCC_API_GATEWAY} from './constants';
import WebSocket from './WebSocket';

const REGISTER_EVENT = 'register';

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  namespace = 'ContactCenter';
  $config: CCPluginConfig;
  $webex: WebexSDK;
  wccApiUrl: string;
  webSocket: WebSocket;
  ciUserId: string;
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

  public async register(): Promise<string> {
    this.wccApiUrl = this.$webex.internal.services.get(WCC_API_GATEWAY);

    this.listenForWebSocketEvents();

    return new Promise((resolve, reject) => {
      this.addEventHandler(REGISTER_EVENT, resolve, reject);

      this.establishConnection(); // Establish the connection after setting up the event listener
    });
  }

  private listenForWebSocketEvents() {
    this.webSocket.on(EVENT, (event: any) => {
      console.log('Event received:', event);
      switch (event.type) {
        case CC_EVENTS.WELCOME:
          this.ciUserId = event.data.agentId;
          this.handleEvent(REGISTER_EVENT, `Success: CI User ID is ${this.ciUserId}`);
          break;
      }
    });
  }

  private async establishConnection(): Promise<void> {
    const datachannelUrl = `${this.wccApiUrl}${SUBSCRIBE_API}`;

    const connectionConfig = {
      force: this.$config?.force ?? true,
      isKeepAliveEnabled: this.$config?.isKeepAliveEnabled ?? false,
      clientType: this.$config?.clientType ?? 'WxCCSDK',
      allowMultiLogin: this.$config?.allowMultiLogin ?? true,
    };

    await this.webSocket.subscribeAndConnect({
      datachannelUrl,
      body: connectionConfig,
    });
  }

  private handleEvent(eventName: string, successMessage: string) {
    const registerRequest = this.eventHandlers.get(eventName);
    if (registerRequest) {
      clearTimeout(registerRequest.timeoutId);
      registerRequest.resolve(successMessage);
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
        reject(new Error('Subscription Failed: Time out'));
        this.eventHandlers.delete(eventName);
      }, WEBSOCKET_EVENT_TIMEOUT),
    });
  }
}
