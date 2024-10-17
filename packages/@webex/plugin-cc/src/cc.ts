/* eslint-disable no-console */
import {WebexPlugin} from '@webex/webex-core';
import {CCPluginConfig, IContactCenter, WebexSDK} from './types';
import {
  CC_EVENTS,
  EVENT,
  READY,
  REGISTER_TIMEOUT,
  SUBSCRIBE_API,
  WCC_API_GATEWAY,
} from './constants';
import WebSocket from './WebSocket';

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  namespace = 'ContactCenter';
  $config: CCPluginConfig;
  $webex: WebexSDK;
  wccApiUrl: string;
  webSocket: WebSocket;
  ciUserId: string;
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

  private establishConnection(): void {
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

  register(): Promise<string> {
    this.wccApiUrl = this.$webex.internal.services.get(WCC_API_GATEWAY);

    return new Promise((resolve, reject) => {
      const timeoutDuration = REGISTER_TIMEOUT;

      const timeout = setTimeout(() => {
        reject(new Error('Subscription Failed: Time out'));
      }, timeoutDuration);
      this.webSocket.on(EVENT, (event: any) => {
        // TODO:  Create an Event interface to handle all events after Parv's PR
        if (event.type === CC_EVENTS.WELCOME) {
          this.ciUserId = event.data.agentId;
          // TODO: call getAgentProfile Method here
          clearTimeout(timeout); // Clear the timeout if the Welcome event occurs
          // TODO: resolve with AgentProfile after Parv's PR
          resolve(`Success: CI User ID is ${this.ciUserId}`);
        }
      });

      this.establishConnection(); // Establish the connection after setting up the event listener
    });
  }
}
