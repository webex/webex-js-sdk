import {WebexPlugin} from '@webex/webex-core';
import { EVENT, POST_AUTH, SUBSCRIBE_API, WCC_API_GATEWAY, WEBEX_READY } from '../constants';

export default class ContactCenter extends WebexPlugin {
    webex: any;
    wccApiUrl = '';
    constructor(webex) {
        super();
        this.webex = webex
        this.webex.once(WEBEX_READY, () => {
            // this.emit('cc:ready');
        });
    }

    private handleAgentEvents() {
        console.log('WebexCC:index#handleAgentEvents --> ');
        //TODO: Placeholder for event handling, this needs to be in different file dedicated for event listeners 
    }

    async register() {
        await this.webex.internal.services.waitForCatalog(POST_AUTH);
        this.wccApiUrl = this.webex.internal.services.get(WCC_API_GATEWAY);
        this.webex.internal.llmcc.registerWithBodyAndConnect(`${this.wccApiUrl}${SUBSCRIBE_API}`, {
            isKeepAliveEnabled: false,
            clientType: 'WebexCCSDK',
            allowMultiLogin: true,
            force: true,
        })
        .then((result: any) => {
            this.webex.internal.llmcc.off(EVENT, this.handleAgentEvents);
            this.webex.internal.llmcc.on(EVENT, this.handleAgentEvents);
            console.log('WebexCC:index#updateLLMConnection --> enabled to receive relay events!');

            return Promise.resolve(result);
        })
        .catch((error: any) => {
            return Promise.reject(error);
        });
    }
}