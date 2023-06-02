import {
  createClient,
  createCallHistoryClient,
  createVoicemailClient,
  createContactsClient,
  createCallSettingsClient,
} from '@webex/calling';

require('@webex/internal-plugin-device');
const merge = require('lodash/merge');
const WebexCore = require('@webex/webex-core').default;

const config = require('./config');

const Webex = WebexCore.extend({
  webex: true,
});
class Calling {
  // pass in logger as well if needed
  constructor({webex, options}) {
    if (webex) {
      this.webex = webex;
    }
    options.config = merge({}, config, options.config);

    this.webex = new Webex({options});
  }

  createClient() {
    return createClient(this.webex, config);
  }

  createCallHistoryClient() {
    return createCallHistoryClient(this.webex, this.logger);
  }

  createVoicemailClient() {
    return createVoicemailClient(this.webex, this.logger);
  }

  createContactsClient() {
    return createContactsClient(this.webex, this.logger);
  }

  createCallSettingsClient() {
    return createCallSettingsClient(this.webex, this.logger);
  }
}

export {Calling};
