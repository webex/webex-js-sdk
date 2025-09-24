/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {merge} from 'lodash';

/**
 * Interface for plugin options
 */
export interface PluginOptions {
  replace?: boolean;
  proxies?: string[];
  interceptors?: Record<string, any>;
  config?: Record<string, any>;
  payloadTransformer?: {
    predicates?: any[];
    transforms?: any[];
  };
  onBeforeLogout?: (() => void) | (() => void)[];
}

/**
 * Modern plugin registry that replaces the AmpState mixin system
 */
export class PluginRegistry {
  private plugins: Map<string, any> = new Map();
  private internalPlugins: Map<string, any> = new Map();
  private config: Record<string, any> = {};
  private interceptors: Record<string, any> = {};

  /**
   * Register a plugin with the registry
   * @param {string} name - The name of the plugin
   * @param {any} constructor - The plugin constructor
   * @param {PluginOptions} options - Plugin options
   * @param {any} targetClass - The target class to register plugin on
   * @returns {void}
   */
  registerPlugin(
    name: string,
    constructor: any,
    targetClass?: any,
    options: PluginOptions = {}
  ): void {
    if (this.plugins.has(name) && !options.replace) {
      return;
    }

    this.plugins.set(name, constructor);

    // Store plugin on target class prototype if provided
    if (targetClass) {
      if (!targetClass.prototype._children) {
        targetClass.prototype._children = {};
      }
      targetClass.prototype._children[name] = constructor;
    }

    this._handlePluginOptions(name, options);
  }

  /**
   * Register an internal plugin with the registry
   * @param {string} name - The name of the plugin
   * @param {any} constructor - The plugin constructor
   * @param {PluginOptions} options - Plugin options
   * @param {any} targetClass - The target class to register plugin on
   * @returns {void}
   */
  registerInternalPlugin(
    name: string,
    constructor: any,
    targetClass?: any,
    options: PluginOptions = {}
  ): void {
    if (this.internalPlugins.has(name) && !options.replace) {
      return;
    }

    this.internalPlugins.set(name, constructor);

    // Store internal plugin on target class prototype if provided
    if (targetClass) {
      if (!targetClass.prototype._children) {
        targetClass.prototype._children = {};
      }
      targetClass.prototype._children[name] = constructor;
    }

    this._handlePluginOptions(name, options);
  }

  /**
   * Handle common plugin options (config, interceptors, etc.)
   * @private
   */
  private _handlePluginOptions(name: string, options: PluginOptions): void {
    // Handle plugin configuration
    if (options.config) {
      merge(this.config, options.config);
    }

    // Handle interceptors
    if (options.interceptors) {
      Object.assign(this.interceptors, options.interceptors);
    }

    // Handle payload transformers
    if (options.payloadTransformer?.predicates) {
      this.config.payloadTransformer = this.config.payloadTransformer || {};
      this.config.payloadTransformer.predicates = (
        this.config.payloadTransformer.predicates || []
      ).concat(options.payloadTransformer.predicates);
    }

    if (options.payloadTransformer?.transforms) {
      this.config.payloadTransformer = this.config.payloadTransformer || {};
      this.config.payloadTransformer.transforms = (
        this.config.payloadTransformer.transforms || []
      ).concat(options.payloadTransformer.transforms);
    }

    // Handle before logout callbacks
    if (options.onBeforeLogout) {
      this.config.onBeforeLogout = this.config.onBeforeLogout || [];
      const callbacks = Array.isArray(options.onBeforeLogout)
        ? options.onBeforeLogout
        : [options.onBeforeLogout];

      callbacks.forEach((fn) => {
        this.config.onBeforeLogout.push({
          plugin: name,
          fn,
        });
      });
    }
  }

  /**
   * Get a registered plugin constructor
   * @param {string} name - The name of the plugin
   * @returns {any} The plugin constructor
   */
  getPlugin(name: string): any {
    return this.plugins.get(name);
  }

  /**
   * Get all registered plugins
   * @returns {Map<string, any>} Map of all registered plugins
   */
  getAllPlugins(): Map<string, any> {
    return new Map(this.plugins);
  }

  /**
   * Check if a plugin is registered
   * @param {string} name - The name of the plugin
   * @returns {boolean} True if plugin is registered
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Get the merged configuration from all plugins
   * @returns {Record<string, any>} The merged configuration
   */
  getConfig(): Record<string, any> {
    return this.config;
  }

  /**
   * Get all interceptors from plugins
   * @returns {Record<string, any>} All interceptors
   */
  getInterceptors(): Record<string, any> {
    return this.interceptors;
  }

  /**
   * Initialize plugins on a target object
   * @param {any} target - The target object to initialize plugins on
   * @param {Record<string, any>} baseConfig - Base configuration
   * @returns {void}
   */
  initializePlugins(target: any, baseConfig: Record<string, any> = {}): void {
    // Merge plugin configs with base config
    const finalConfig = merge({}, baseConfig, this.config);

    // Initialize each plugin
    this.plugins.forEach((PluginConstructor, name) => {
      if (!target[name]) {
        target[name] = new PluginConstructor(
          {},
          {
            parent: target,
            namespace: name,
          }
        );
      }
    });

    // Apply interceptors
    Object.assign(target.interceptors || {}, this.interceptors);

    // Set merged config
    target.config = finalConfig;
  }

  /**
   * Clear all registered plugins
   * @returns {void}
   */
  clear(): void {
    this.plugins.clear();
    this.config = {};
    this.interceptors = {};
  }
}

// Export singleton instance
export const pluginRegistry = new PluginRegistry();
