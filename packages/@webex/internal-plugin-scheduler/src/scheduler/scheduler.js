import {WebexPlugin} from '@webex/webex-core';

import CONSTANTS from './scheduler.constants';

/**
 * Scheduler WebexPlugin class.
 */
class Scheduler extends WebexPlugin {
  /**
   * Namespace, or key, to register a `Scheduler` class object to within the
   * `webex.internal` object. Note that only one instance of this class can be
   * used against a single `webex` class instance.
   */
  namespace = CONSTANTS.NAMESPACE;

  /**
   * @param {Object} args Arguments for constructing a new Scheduler instance.
   */
  constructor(...args) {
    super(...args); // Required to properly mount the singleton class instance.

    /**
     * The `this.request` method should now be available for usage.
     * See `http-core` for this tooling.
     */

    /**
     * The mercury connection is available for initialization
     */

    /**
     * The `this.logger` object should now be available for usage.
     * `this.logger.log()`, `this.logger.error()`, `this.logger.warn()`, etc.
     */
    this.logger.log('plugin example constructed'); // example, remove this.
  }

  /**
   * WebexPlugin initialize method. This triggers once Webex has completed its
   * initialization workflow.
   *
   * If the plugin is meant to perform startup actions, place them in this
   * `initialize()` method instead of the `constructor()` method.
   * @returns {void}
   */
  initialize() {
    // Used to perform actions based on the provided configuration object once
    // the configuration object is ready.
    this.listenToOnce(this.webex, 'change:config', () => {
      /* ...perform actions once the configuration object is mounted... */
    });

    // Used to perform actions after webex is fully qualified and ready for
    // operation.
    this.listenToOnce(this.webex, 'ready', () => {
      /* ...perform actions once the webex object is fully qualified... */
    });
  }

  /**
   * Example request usage. `this.request` returns a promise using XHR. and the
   * `request` npm package.
   * @returns {void}
   */
  exampleRequestUsage() {
    // Simple example
    this.request({
      method: 'GET', // method to use for this request
      service: 'example-service', // `service` is federated from U2C. See `this.webex.services.list()` at runtime.
      resource: 'example/resource/path', // full resource path,
    });

    // Complex example
    return this.request({
      uri: 'https://www.example.com', // a URI can be used in place of service/resource.
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: 'example-token',
        'x-custom-header': 'x-custom-header-example-value',
      },
      body: {
        'example-param-a': 'example-param-a-value',
        'example-param-b': 'example-param-b-value',
        'example-param-c': 'example-param-c-value',
      },
    });
  }

  /**
   * Example event usage. Note that an event engine is mapped to `this`
   * upon extending the `WebexPlugin` class constructor. This includes
   * the following methods:
   * `this.listenTo()`, `this.stopListening()`, `this.trigger()`, `this.on()`, etc.
   *
   * Note that all methods provided as event handlers should be associated with
   * a namespace so that they can be referenced/destroyed if/when necessary.
   *
   * @returns {void}
   */
  exampleEventUsage() {
    // listen for locally scoped events [using on, internal]
    this.on('event:scope', (event) => {
      this.logger.log(event);
    });

    // stop listening for locally scoped events.
    this.off('event:scope', () => {
      /* use previous `on` method param namespace instead of arrow function */
    });

    // listen for scoped events [using on, external], replace `this.webex` with `webex` namespace.
    this.webex.internal.scheduler.on('event:scope', (event) => {
      this.logger.log(event);
    });

    // stop listening for scoped events [using on, external], replace `this.webex` with `webex` namespace.
    this.webex.internal.scheduler.off('event:scope', () => {
      /* use previous `on` method param namespace instead of arrow function */
    });

    // listen for scoped events [using listenTo(), plugin-to-plugin].
    this.listenTo(this.webex.pluginName, 'event:scope', (event) => {
      this.logger.log(event);
    });

    // stop listening for scoped events [using listenTo(), plugin-to-plugin].
    this.stopListening(this.webex.pluginName, 'event:scope', () => {
      /* use previous `listenTo` method param namespace instead of arrow function */
    });
  }

  /**
   * Example mercury connection setup. See the above `exampleEventUsage()` for
   * event usage definition.
   *
   * @returns {void}
   */
  exampleMercuryConnection() {
    this.webex.internal.mercury.connect().then(() => {
      // Scope this listener to a trackable namespace
      this.handler = (event) => {
        this.logger.log(event);
        this.trigger('event:scope', event);
      };

      // Start handling events.
      this.listenTo(this.webex.internal.mercury, 'event:scope', this.handler);

      // Stop handling events.
      this.stopListening(this.webex.internal.mercury, 'event:scope', this.handler);
    });
  }
}

export default Scheduler;
