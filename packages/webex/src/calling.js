/* eslint-disable no-console */
import CallingSdk from '@webex/calling';
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

class Calling extends EventEmitter {
  constructor({webex, options, callingConfig}) {
    super();
    this.callingConfig = callingConfig;
    this.sdkConnector = CallingSdk.SDKConnector;

    if (webex) {
      this.webex = webex;
      this.initializeClients();
    } else {
      options.config = merge({}, config, options.config);

      this.webex = new Webex(options);

      this.webex.once('ready', () => {
        this.emit('calling:ready');
      });
    }
  }

  register() {
    return this.webex.internal.device
      .register()
      .then(() => {
        return this.webex.internal.mercury
          .connect()
          .then(() => {
            this.initializeClients();
          })
          .catch((error) => {
            console.log('Error occurred during  mercury.connect()', error);
          });
      })
      .catch((error) => {
        console.log('callingSdk: Error occurred during device.register()', error);
      });
  }

  initializeClients() {
    const {clientConfig, callingClientConfig, logger} = this.callingConfig;

    this.callingClient = clientConfig.calling
      ? CallingSdk.createClient(this.webex, callingClientConfig)
      : undefined;
    this.contactClient = clientConfig.contact
      ? CallingSdk.createContactsClient(this.webex, logger)
      : undefined;
    this.callHistoryClient = clientConfig.callHistory
      ? CallingSdk.createCallHistoryClient(this.webex, logger)
      : undefined;
    this.callSettingsClient = clientConfig.callSettings
      ? CallingSdk.createCallSettingsClient(this.webex, logger)
      : undefined;
    this.voicemailClient = clientConfig.voicemail
      ? CallingSdk.createVoicemailClient(this.webex, logger)
      : undefined;
  }
}

export default Calling;
