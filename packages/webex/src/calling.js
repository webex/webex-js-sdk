import * as WebexCalling from '@webex/calling';
import EventEmitter from 'events';

/* eslint-disable require-jsdoc */
require('@webex/internal-plugin-device');
require('@webex/internal-plugin-mercury');
require('@webex/internal-plugin-encryption');

const merge = require('lodash/merge');
const WebexCore = require('@webex/webex-core').default;

const config = require('./config');

const Webex = WebexCore.extend({
  webex: true,
});

const CALLING_FILE = 'Calling';

const logContext = {
  file: CALLING_FILE,
  method: 'calling.register',
};

class Calling extends EventEmitter {
  constructor({webex, webexConfig, callingConfig}) {
    super();
    this.callingConfig = callingConfig;
    this.log = WebexCalling.Logger;
    this.log.setLogger(callingConfig.logger.level, CALLING_FILE);
    this.registered = false;

    if (webex) {
      this.webex = webex;
    } else {
      webexConfig.config = merge({}, config, webexConfig.config);

      this.webex = new Webex(webexConfig);

      this.webex.once('ready', () => {
        this.emit('ready');
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
          .then(async () => {
            this.log.info('Authentication: webex.internal.mercury.connect successful', logContext);
            this.registered = true;

            try {
              await this.initializeClients();
            } catch (error) {
              this.log.warn(`Error occurred while initializing clients ${error}`, logContext);
            }
          })
          .catch((error) => {
            this.log.warn(`Error occurred during mercury.connect() ${error}`, logContext);
          });
      })
      .catch((error) => {
        this.log.warn(`Error occurred during device.register() ${error}`, logContext);
      });
  }

  async deregister() {
    if (!this.registered) {
      this.log.info('Authentication: webex.internal.device.deregister already done', logContext);

      return Promise.resolve();
    }

    const lines = Object.values(this.callingClient?.getLines());

    for (const line of lines) {
      if (line.getStatus() === 'active') {
        line.deregister();
      }
    }

    return (
      // @ts-ignore
      this.webex.internal.mercury
        .disconnect()
        .then(() => {
          this.log.info('Authentication: webex.internal.mercury.disconnect successful', logContext);

          // @ts-ignore
          return this.webex.internal.device.unregister();
        })
        .then(() => {
          this.log.info('Authentication: webex.internal.device.deregister successful', logContext);
          this.registered = false;
        })
        .catch((error) => {
          this.log.warn(
            `Error occurred during mercury.disconnect() or device.deregister() ${error}`,
            logContext
          );
        })
    );
  }

  async initializeClients() {
    const {clientConfig, callingClientConfig, logger} = this.callingConfig;

    this.callingClient = clientConfig.calling
      ? await WebexCalling.createClient(this.webex, callingClientConfig)
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

  static get createMicrophoneStream() {
    return WebexCalling.createMicrophoneStream;
  }

  static createNoiseReductionEffect(options) {
    return new WebexCalling.NoiseReductionEffect(options);
  }
}

const createCalling = async ({webex, webexConfig, callingConfig}) => {
  const callingInstance = new Calling({webex, webexConfig, callingConfig});
  if (webex) {
    await callingInstance.initializeClients();
  }

  return callingInstance;
};

Calling.init = async (attrs) => {
  const callingInstance = await createCalling(attrs);

  return callingInstance;
};

export default Calling;
