import WebexCalling from '@webex/calling';
import EventEmitter from 'events';

/* eslint-disable require-jsdoc */
require('@webex/internal-plugin-device');
require('@webex/internal-plugin-mercury');

const merge = require('lodash/merge');
const WebexCore = require('@webex/webex-core').default;

const config = require('./config');

const Webex = WebexCore.extend({
  webex: true,
});

const logContext = {
  file: 'Calling',
  method: 'calling.register',
};

class Calling extends EventEmitter {
  constructor({webex, webexConfig, callingConfig}) {
    super();
    this.callingConfig = callingConfig;
    this.log = WebexCalling.Logger;
    this.log.setLogger(callingConfig.logger.level);

    if (webex) {
      this.webex = webex;
      this.initializeClients();
    } else {
      webexConfig.config = merge({}, config, webexConfig.config);

      this.webex = new Webex(webexConfig);

      this.webex.once('ready', () => {
        this.emit('calling:ready');
      });
    }
  }

  register() {
    return this.webex.internal.device
      .register()
      .then(() => {
        this.log.info('Authentication: webex.internal.device.register successful', logContext);

        return this.webex.internal.mercury
          .connect()
          .then(() => {
            this.log.info('Authentication: webex.internal.mercury.connect successful', logContext);
            this.initializeClients();
          })
          .catch((error) => {
            this.log.warn(`Error occurred during mercury.connect() ${error}`, logContext);
          });
      })
      .catch((error) => {
        this.log.warn(`Error occurred during device.register() ${error}`, logContext);
      });
  }

  initializeClients() {
    const {clientConfig, callingClientConfig, logger} = this.callingConfig;

    this.callingClient = clientConfig.calling
      ? WebexCalling.createClient(this.webex, callingClientConfig)
      : undefined;

    this.contactClient = clientConfig.contact
      ? WebexCalling.createContactsClient(this.webex, logger)
      : undefined;

    this.callHistoryClient = clientConfig.callHistory
      ? WebexCalling.createCallHistoryClient(this.webex, logger)
      : undefined;

    this.voicemailClient = clientConfig.voicemail
      ? WebexCalling.createVoicemailClient(this.webex, logger)
      : undefined;

    this.callSettingsClient = clientConfig.callSettings
      ? WebexCalling.createCallSettingsClient(this.webex, logger)
      : undefined;
  }
}

export default Calling;
