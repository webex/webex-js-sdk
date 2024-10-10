import {WebexPlugin} from '@webex/webex-core';
import {CCConfig, IContactCenter, WebexSDK} from './types';

export default class ContactCenter extends WebexPlugin implements IContactCenter {
  namespace = 'WebexCC';
  $config: CCConfig;
  $webex: WebexSDK;
  wccAPIURL: string;

  constructor(...args) {
    super(...args);
    // @ts-ignore
    this.$config = this.config;
    // @ts-ignore
    this.$webex = this.webex;
  }

  register(success: boolean): Promise<string> {
    // TODO: Mercury Subsciption code should be added as part of this function
    return new Promise((resolve, reject) => {
      try {
        setTimeout(() => {
          if (success) {
            resolve('Success: Dummy data returned');
          } else {
            throw new Error('Simulated error');
          }
        }, 1000);
      } catch (error) {
        reject(new Error('Simulated error'));
      }
    });
  }
}
