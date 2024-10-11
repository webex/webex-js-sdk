import {WebexPlugin} from '@webex/webex-core';
import {CCPluginConfig, IContactCenter, WebexSDK} from './types';
import {SUBSCRIBE_API, WCC_API_GATEWAY} from './constants';
import CCMercury from './CCMercury';

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  namespace = 'ContactCenter';
  $config: CCPluginConfig;
  $webex: WebexSDK;
  wccApiUrl: string;
  ccMercury: typeof CCMercury;
  ciUserId: string;
  constructor(...args) {
    super(...args);
    // @ts-ignore
    this.$config = this.config;
    // @ts-ignore
    this.$webex = this.webex;
  }

  register(): Promise<string> {
    this.wccApiUrl = this.$webex.internal.services.get(WCC_API_GATEWAY);
    this.ccMercury = new CCMercury(
      {},
      {
        parent: this.$webex,
      }
    );

    this.ccMercury.registerAndConnect(`${this.wccApiUrl}${SUBSCRIBE_API}`, {
      force: this.$config?.force || true,
      isKeepAliveEnabled: this.$config?.isKeepAliveEnabled || false,
      clientType: this.$config?.clientType || 'WxCCSDK',
      allowMultiLogin: this.$config?.allowMultiLogin || true,
    });

    return new Promise((resolve, reject) => {
      const timeoutDuration = 20000; // Define your timeout duration here (e.g., 10 seconds)

      const timeout = setTimeout(() => {
        reject(new Error('Timeout: Welcome event did not occur within the expected time frame'));
      }, timeoutDuration);

      this.ccMercury.on('event', (event) => {
        if (event.type === 'Welcome') {
          this.ciUserId = event.data.agentId;
          // TODO: call get AgentProfile Method here
          clearTimeout(timeout); // Clear the timeout if the Welcome event occurs
          resolve(`Success: CI User ID is ${this.ciUserId}`);
        }
      });
    });
  }
}
