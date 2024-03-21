import {readonly} from 'core-decorators';
import AmpEvents from 'ampersand-events';

// hold onto weak references to parent' Webexs to help avoid retain cycles
const webexs = new WeakMap();

/**
 * Base plugin class. Doesn't depend on Ampersand State
 */
export default class StatelessWebexPlugin {
  /**
   * The config for this plugin's namespace. If no namespace has been set
   * returns all of webex's config.
   * @type {Object}
   */
  get config() {
    let namespace = this.getNamespace ? this.getNamespace() : this.namespace;

    if (namespace) {
      namespace = namespace.toLowerCase();

      return this.webex.config[namespace];
    }

    return this.webex.config;
  }

  /**
   * A reference to the webex logger.
   * @type {Logger}
   */
  get logger() {
    return this.webex.logger;
  }

  /**
   * A reference to the main sdk instance
   * @type {WebexCore}
   */
  get webex() {
    return webexs.get(this);
  }

  @readonly
  /**
   * Mostly here for compatibility with legacy WebexPlugins.
   * StatelessWebexPlugins will never have a state other than ready, however, if
   * we implement stateful WebexPlugins as es6 classes, they may have the option
   * to have ready be false
   * @private
   * @type {boolean}
   */
  ready = true;

  /**
   * Constructor. One of attrs.webex or options.parent is required
   * @param {Object} attrs
   * @param {WebexCore} [attrs.webex]
   * @param {Object} options
   * @param {WebexCore} [options.parent]
   */
  constructor(attrs = {}, options = {}) {
    let webex = attrs.webex || options.parent;

    if (!webex) {
      throw new Error(
        'One of `attrs.webex` or `options.parent` must be supplied when initializing a StatelessWebexPlugin'
      );
    }

    while (webex.parent || webex.collection) {
      webex = webex.parent || webex.collection;
    }
    webexs.set(this, webex);
  }

  /**
   * Proxies to {@link WebexPlugin#webex}'s `request()` method.
   * @see WebexCore#request
   * @param {Array<mixed>} args
   * @returns {Promise}
   */
  request(...args) {
    return this.webex.request(...args);
  }

  /**
   * Proxies to {@link WebexPlugin#webex}'s `upload()` method.
   * @see WebexCore#upload
   * @param {Array<mixed>} args
   * @returns {Promise}
   */
  upload(...args) {
    return this.webex.upload(...args);
  }
}

Object.assign(StatelessWebexPlugin.prototype, AmpEvents);
