import {WebexPlugin} from '@webex/webex-core';
import {WEBEX_READY } from './constants';

export default class ContactCenter extends WebexPlugin {
    clientType = '';
    wccApiUrl = '';
    namespace = 'WebexCC';
  
    constructor(...args) {
        super(...args);
        this.webex.once(WEBEX_READY, () => {
            console.log('WebexCC: webex object ready: ', this.webex);
            // this.emit(CC_READY);
        });
    }

    register(success: boolean) {
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