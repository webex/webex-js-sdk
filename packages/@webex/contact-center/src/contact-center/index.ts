import {WebexPlugin} from '@webex/webex-core';
import EventEmitter from 'events';
import { CC_READY, EVENT, POST_AUTH, SUBSCRIBE_API, WCC_API_GATEWAY, WEBEX_READY } from '../constants';

export default class ContactCenter extends WebexPlugin {
    clientType = '';
    wccApiUrl = '';
    webex: any;
  
    constructor(...options) {
        super(...options);
        this.webex = webex;
        // this.webex.once(WEBEX_READY, () => {
        //     this.emit(CC_READY);
        // });
    }

    private handleAgentEvents(event: any) {
        console.log('WebexCC:index#handleAgentEvents --> event ', event);
        //TODO: Placeholder for event handling, this needs to be in different file dedicated for event listeners 
    }

    async register() {
        await this.webex.internal.services.waitForCatalog(POST_AUTH);
        this.wccApiUrl = this.webex.internal.services.get(WCC_API_GATEWAY);
        this.webex.internal.llmcc.registerWithBodyAndConnect(`${this.wccApiUrl}${SUBSCRIBE_API}`, {
            isKeepAliveEnabled: false,
            clientType: this.clientType,
            allowMultiLogin: true,
            force: true,
        })
        .then((result: any) => {
            this.webex.internal.llmcc.off(EVENT, this.handleAgentEvents);
            this.webex.internal.llmcc.on(EVENT, this.handleAgentEvents);
            console.log('WebexCC:index#register --> receive contact center events');

            return Promise.resolve(result);
        })
        .catch((error: any) => {
            return Promise.reject(error);
        });
    }
}