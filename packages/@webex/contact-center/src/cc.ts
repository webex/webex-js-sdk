import {WebexPlugin} from '@webex/webex-core';

export default class ContactCenter extends WebexPlugin {
    letclientType = '';
    wccApiUrl = '';
    namespace = 'WebexCC';
    $webex: any;

  
    constructor(...args) {
        super(...args);
        //@ts-ignore
        this.$webex = this.webex;
        console.log('pkesari_local webex object: ', this.$webex);
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