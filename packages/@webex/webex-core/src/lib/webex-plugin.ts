import {WebexState, IChangePayload} from '@webex/common';
import {makeWebexPluginStore} from './storage';

// Define a type for the constructor options to ensure type safety.
type WebexPluginOptions = {
  parent?: any;
  collection?: any;
  namespace?: string;
};

/**
 * @class WebexPlugin
 * @extends {WebexState<any>}
 * @description Base class for all Webex plugins. It provides a standard
 * structure for plugins, including state management, event handling, and
 * access to the core Webex instance.
 */
class WebexPlugin extends WebexState<any> {
  // EventEmitter methods
  on: (event: string, listener: (...args: any[]) => void) => this;
  once: (event: string, listener: (...args: any[]) => void) => this;
  off: (event: string, listener: (...args: any[]) => void) => this;
  emit: (event: string, ...args: any[]) => boolean;
  removeAllListeners: (event: string) => this;

  // Explicitly type the properties of the class.
  public parent: any;
  public collection: any;
  public namespace: string;

  /**
   * @constructs WebexPlugin
   * @param {any} attrs - Attributes to pass to the state constructor.
   * @param {WebexPluginOptions} options - Options for the plugin, including parent, collection, and namespace.
   */
  constructor(attrs: any, options: WebexPluginOptions) {
    super({...attrs, ...options});

    // Set properties from options.
    this.parent = options.parent;
    this.collection = options.collection;
    this.namespace = options.namespace;

    // Set up a listener for change events on the plugin's state.
    this.on('change', (payload: IChangePayload<any, any>) => {
      if (this.parent) {
        // Trigger a change event on the parent, prefixed with the plugin's namespace.
        this.parent.emit(`change:${this.getNamespace().toLowerCase()}`, this.parent, this, payload);
      }
    });
  }

  /**
   * @function getNamespace
   * @returns {string} The namespace of the plugin.
   * @description Returns the namespace of the plugin, used for configuration and event scoping.
   */
  public getNamespace(): string {
    return this.namespace;
  }

  /**
   * @function request
   * @param {any} options - The options for the request.
   * @returns {Promise<any>} A promise that resolves with the response.
   * @description A convenience method for making API requests through the core Webex instance.
   */
  public request(options: any): Promise<any> {
    return this.webex.request(options);
  }

  /**
   * @function upload
   * @param {any} options - The options for the upload.
   * @returns {Promise<any>} A promise that resolves with the response.
   * @description A convenience method for uploading files through the core Webex instance.
   */
  public upload(options: any): Promise<any> {
    return this.webex.upload(options);
  }

  /**
   * @function when
   * @param {string} eventName - The name of the event to wait for.
   * @returns {Promise<any[]>} A promise that resolves with the arguments of the event.
   * @description A helper method to wait for a single occurrence of an event.
   */
  public when(eventName: string): Promise<any[]> {
    return new Promise((resolve) => {
      this.once(eventName, (...args: any[]) => resolve(args));
    });
  }

  /**
   * @property {any} boundedStorage
   * @description Provides access to the bounded storage for this plugin, which is
   * automatically cleared when the user logs out.
   */
  get boundedStorage(): any {
    return makeWebexPluginStore('bounded', this as any);
  }

  /**
   * @property {any} unboundedStorage
   * @description Provides access to the unbounded storage for this plugin, which
   * persists across sessions and is not cleared on logout.
   */
  get unboundedStorage(): any {
    return makeWebexPluginStore('unbounded', this as any);
  }

  /**
   * @property {any} config
   * @description Provides access to the plugin-specific configuration from the
   * main Webex config object.
   */
  get config(): any {
    if (this.webex && this.webex.config) {
      const namespace = this.getNamespace();

      if (namespace) {
        return this.webex.config[namespace.toLowerCase()];
      }

      return this.webex.config;
    }

    return {};
  }

  /**
   * @property {any} logger
   * @description Provides access to the logger instance from the main Webex object.
   * Falls back to the console if the logger is not available.
   */
  get logger(): any {
    return this.webex.logger || console;
  }

  /**
   * @property {any} webex
   * @description Provides access to the main Webex instance by traversing up the
   * parent/collection chain.
   * @throws {Error} If the `webex` instance cannot be determined.
   */
  get webex(): any {
    if (!this.parent && !this.collection) {
      throw new Error(
        'Cannot determine `this.webex` without `this.parent` or `this.collection`. Please initialize `this` via `children` or `collection` or set `this.parent` manually'
      );
    }

    let p = this as any;

    while (p.parent || p.collection) {
      p = p.parent || p.collection;
    }

    return p;
  }
}

export default WebexPlugin;
