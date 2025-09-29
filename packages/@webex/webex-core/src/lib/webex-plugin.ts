/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexState} from '@webex/common';
import {makeWebexPluginStore} from './storage';

// Define a type for the constructor options to ensure type safety.
type WebexPluginOptions = {
  parent?: any;
  collection?: any;
  namespace?: string;
  webex?: any;
};

/**
 * @class WebexPlugin
 * @extends {WebexState}
 * @description Base class for all Webex plugins. It provides a standard
 * structure for plugins, including state management, event handling, and
 * access to the core Webex instance.
 *
 * CRITICAL: This class extends WebexState to provide reactive state management
 * with automatic change event emission. This enables storage decorators to work
 * by providing the set/get methods and change events they depend on.
 */
class WebexPlugin extends WebexState {
  // Explicitly type the properties of the class.
  public parent: any;
  public collection: any;
  public namespace: string;
  private _ready = true;
  private _webex?: any; // Store the explicitly passed webex instance

  /**
   * Gets the ready state of the plugin
   */
  get ready(): boolean {
    return this._ready;
  }

  /**
   * Sets the ready state of the plugin and emits change:ready event
   * @param {boolean} value - The new ready state value
   */
  set ready(value: boolean) {
    this._ready = value;
    (this as any).emit('change:ready', value);
  }

  /**
   * @constructs WebexPlugin
   * @param {any} attrs - Attributes to pass to the plugin constructor.
   * @param {WebexPluginOptions} options - Options for the plugin, including parent, collection, and namespace.
   */
  constructor(attrs: any = {}, options: WebexPluginOptions = {}) {
    // Call WebexState constructor with initial attributes for reactive state management
    // This provides the set/get methods and change events that storage decorators need
    super(attrs, options);

    // Set properties from options.
    this.parent = options.parent;
    this.collection = options.collection;
    this.namespace = options.namespace || 'unknown';
    this._webex = options.webex; // Store the explicitly passed webex instance

    // Set up a listener for change events on the plugin's state.
    (this as any).on('change', (payload: any) => {
      if (this.parent) {
        // Trigger a change event on the parent, prefixed with the plugin's namespace.
        this.parent.emit(`change:${this.getNamespace().toLowerCase()}`, this.parent, this, payload);
      }
    });

    // CRITICAL: Call initialize() immediately after construction to trigger decorator chain like AmpState did
    // This ensures @persist and @waitForValue decorators can wrap this.webex.initialize
    // BEFORE WebexCore calls its own initialize() method
    // Must happen synchronously but after constructor completes for proper timing with decorator system
    process.nextTick(() => {
      if (typeof (this as any).initialize === 'function') {
        try {
          (this as any).initialize(attrs, options);
        } catch (error) {
          console.warn(`WebexPlugin: Failed to initialize plugin '${this.namespace}':`, error);
        }
      }
    });
  }

  /**
   * Get the namespace for this plugin.
   * @returns {string} The namespace of the plugin.
   */
  getNamespace(): string {
    return this.namespace || this.constructor.name;
  }

  /**
   * Get bounded storage for this plugin.
   * @returns {any} The bounded storage instance.
   */
  get boundedStorage(): any {
    return makeWebexPluginStore('bounded', this as any);
  }

  /**
   * Get unbounded storage for this plugin.
   * @returns {any} The unbounded storage instance.
   */
  get unboundedStorage(): any {
    return makeWebexPluginStore('unbounded', this as any);
  }

  /**
   * Get the configuration for this plugin.
   * @returns {any} The plugin configuration.
   */
  get config(): any {
    if (this.webex && this.webex.config) {
      const namespace = this.getNamespace();
      if (namespace) {
        // Look for plugin-specific config using the namespace (e.g., 'meetings', 'credentials')
        const pluginConfig = this.webex.config[namespace.toLowerCase()];
        if (pluginConfig) {
          return pluginConfig;
        }

        // Fallback: if no plugin-specific config found, return empty object
        // This prevents plugins from accessing the entire webex.config
        return {};
      }

      // If no namespace, return empty config (safer than returning entire webex.config)
      return {};
    }

    return {};
  }

  /**
   * Get the logger for this plugin.
   * @returns {any} The logger instance.
   */
  get logger(): any {
    return this.webex?.logger || console;
  }

  /**
   * Get the webex instance - prefer explicitly passed webex, fallback to parent traversal.
   * @returns {any} The root webex instance.
   */
  get webex(): any {
    // CRITICAL FIX: If webex was explicitly passed in constructor options, use it directly
    // This fixes the core issue where WebexCore passes webex but it gets ignored
    if (this._webex) {
      return this._webex;
    }

    // Fallback to original parent chain traversal for backward compatibility
    if (!this.parent && !this.collection) {
      throw new Error(
        'Cannot determine `this.webex` without `this.parent` or `this.collection`. Please initialize `this` via `children` or `collection` or set `this.parent` manually'
      );
    }

    /* eslint consistent-this: [0] */
    /* eslint @typescript-eslint/no-this-alias: [0] */
    let current: any = this;

    while (current.parent || current.collection) {
      current = current.parent || current.collection;
    }

    return current;
  }

  /**
   * Make HTTP requests through the webex instance.
   * @param {...any} args - Arguments to pass to the request method.
   * @returns {Promise<any>} The request promise.
   */
  request(...args: any[]): Promise<any> {
    return this.webex.request(...args);
  }

  /**
   * Upload files through the webex instance.
   * @param {...any} args - Arguments to pass to the upload method.
   * @returns {Promise<any>} The upload promise.
   */
  upload(...args: any[]): Promise<any> {
    return this.webex.upload(...args);
  }

  /**
   * Wait for an event to be triggered and return a promise.
   * @param {string} eventName - The name of the event to wait for.
   * @param {...any} rest - Additional arguments (should be empty).
   * @returns {Promise<any[]>} A promise that resolves when the event is triggered.
   */
  when(eventName: string, ...rest: any[]): Promise<any[]> {
    if (rest && rest.length > 0) {
      throw new Error('#when() does not accept a callback, you must attach to its promise');
    }

    return new Promise((resolve) => {
      (this as any).once(eventName, (...args: any[]) => resolve(args));
    });
  }

  /**
   * Listen to an event and run the callback immediately if the current state warrants it.
   * This replaces AmpState's listenToAndRun method with pure EventEmitter pattern.
   *
   * For events like 'change:property', it will also run the callback immediately if the property exists.
   * For other events, it just sets up the listener.
   *
   * @param {any} target - Target object to listen to
   * @param {string} eventName - Event name to listen for
   * @param {Function} callback - Callback function to execute
   * @returns {void}
   */
  listenToAndRun(target: any, eventName: string, callback: (...args: any[]) => void): void {
    // Listen for future changes
    if (typeof target.on === 'function') {
      target.on(eventName, callback);
    } else if (typeof target.addEventListener === 'function') {
      target.addEventListener(eventName, callback);
    }

    // Check if we should run the callback immediately for 'change:' events
    if (eventName.startsWith('change:')) {
      const propertyPath = eventName.substring(7); // Remove 'change:' prefix
      const value = this._getNestedProperty(target, propertyPath);

      // If the property exists (even if falsy), run the callback
      if (value !== undefined) {
        callback.call(this, value);
      }
    }
  }

  /**
   * Helper method to get nested property values (e.g., 'internal.device.features.developer')
   * @param {any} obj - Object to traverse
   * @param {string} path - Property path (dot-separated)
   * @returns {any} Property value or undefined
   */
  private _getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, prop) => {
      return current?.[prop];
    }, obj);
  }

  /**
   * Clear the plugin state while preserving parent relationships.
   * @param {any} options - Options for clearing.
   * @returns {WebexPlugin} This plugin instance.
   */
  clear(options?: any): WebexPlugin {
    // Clear all attributes except parent
    const keys = Object.keys(this);
    keys.forEach((key) => {
      if (key !== 'parent' && key !== 'collection' && key !== 'namespace' && key !== 'ready') {
        delete (this as any)[key];
      }
    });

    return this;
  }
}

export default WebexPlugin;
