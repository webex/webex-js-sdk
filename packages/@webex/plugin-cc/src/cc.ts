import {WebexPlugin} from '@webex/webex-core';
import {CCPluginConfig, IContactCenter, WebexSDK} from './types';
import {CC_EVENTS, REGISTER_TIMEOUT, SUBSCRIBE_API, WCC_API_GATEWAY} from './constants';
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
    this.wccApiUrl = this.$webex.internal.services.get(WCC_API_GATEWAY);
    this.ccMercury = new CCMercury(
      {},
      {
        parent: this.$webex,
      }
    );
  }

  register(): Promise<string> {
    this.$webex.logger.log(`ContactCenter: Registering ${this.$config}`);

    this.ccMercury.registerAndConnect(`${this.wccApiUrl}${SUBSCRIBE_API}`, {
      force: this.$config?.force || true,
      isKeepAliveEnabled: this.$config?.isKeepAliveEnabled || false,
      clientType: this.$config?.clientType || 'WxCCSDK',
      allowMultiLogin: this.$config?.allowMultiLogin || true,
    });

    return new Promise((resolve, reject) => {
      const timeoutDuration = REGISTER_TIMEOUT; // Define your timeout duration here (e.g., 10 seconds)

      const timeout = setTimeout(() => {
        reject(new Error('Subscription Failed: Time out'));
      }, timeoutDuration);

      this.ccMercury.on('event', (event) => {
        if (event.type === CC_EVENTS.Welcome) {
          this.ciUserId = event.data.agentId;
          // TODO: call get AgentProfile Method here
          clearTimeout(timeout); // Clear the timeout if the Welcome event occurs
          resolve(`Success: CI User ID is ${this.ciUserId}`); // TODO: resolve with AgentProfile after Parv's PR
        }
      });
    });
  }
}
