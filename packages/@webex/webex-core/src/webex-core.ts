/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {EventEmitter} from 'events';
import util from 'util';

import {proxyEvents, retry, transferEvents, WebexState} from '@webex/common';
import {
  defaults as requestDefaults,
  protoprepareFetchOptions as prepareFetchOptions,
  setTimingsAndFetch as _setTimingsAndFetch,
} from '@webex/http-core';
import {defaultsDeep, get, isFunction, isString, last, merge, omit, set, unset} from 'lodash';
import uuid from 'uuid';

import AuthInterceptor from './interceptors/auth';
import NetworkTimingInterceptor from './interceptors/network-timing';
import PayloadTransformerInterceptor from './interceptors/payload-transformer';
import RedirectInterceptor from './interceptors/redirect';
import RequestEventInterceptor from './interceptors/request-event';
import RequestLoggerInterceptor from './interceptors/request-logger';
import RequestTimingInterceptor from './interceptors/request-timing';
import ResponseLoggerInterceptor from './interceptors/response-logger';
import WebexHttpError from './lib/webex-http-error';
import UserAgentInterceptor from './interceptors/user-agent';
import ProxyInterceptor from './interceptors/proxy';
import WebexTrackingIdInterceptor from './interceptors/webex-tracking-id';
import WebexUserAgentInterceptor from './interceptors/webex-user-agent';
import RateLimitInterceptor from './interceptors/rate-limit';
import EmbargoInterceptor from './interceptors/embargo';
import DefaultOptionsInterceptor from './interceptors/default-options';
import HostMapInterceptor from './lib/interceptors/hostmap';
import config from './config';
import {makeWebexStore} from './lib/storage';
import {pluginRegistry} from './lib/plugin-registry';
import WebexInternalCore from './webex-internal-core';

// TypeScript interfaces for better type safety
export interface WebexCoreOptions {
  config?: any;
  credentials?: any;
  authorization?: any;
  [key: string]: any;
}

export interface UploadOptions {
  file: any;
  phases?: {
    initialize?: any;
    upload?: any;
    finalize?: any;
  };
  [key: string]: any;
}

export interface TransformPredicate {
  direction?: string;
  name: string;
  test: (ctx: any, object: any) => Promise<boolean>;
  extract: (object: any) => Promise<any>;
}

export interface Transform {
  name: string;
  direction?: string;
  alias?: string;
  fn: (ctx: any, ...rest: any[]) => any;
}

export interface PayloadTransformerConfig {
  predicates: TransformPredicate[];
  transforms: Transform[];
}

export interface WebexCoreConfig {
  trackingIdPrefix?: string;
  trackingIdBase?: string;
  trackingIdSuffix?: string;
  interceptors?: any;
  payloadTransformer?: PayloadTransformerConfig;
  onBeforeLogout?: Array<{plugin: string; fn: Function}>;
  [key: string]: any;
}

// Declare global PACKAGE_VERSION
declare const PACKAGE_VERSION: string;

// Interface to ensure WebexCore has EventEmitter methods available
// This helps TypeScript understand the inheritance chain: WebexCore -> WebexState -> WebexEventEmitter -> EventEmitter
interface WebexCoreEventEmitter {
  emit(event: string | symbol, ...args: any[]): boolean;
  on(event: string | symbol, listener: (...args: any[]) => void): this;
  once(event: string | symbol, listener: (...args: any[]) => void): this;
  off(event: string | symbol, listener: (...args: any[]) => void): this;
  removeAllListeners(event?: string | symbol): this;
  addListener(event: string | symbol, listener: (...args: any[]) => void): this;
  removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
  listeners(event: string | symbol): Function[];
  listenerCount(event: string | symbol): number;
  eventNames(): (string | symbol)[];
}

// Create a simplified HttpStatusInterceptor creator
const createHttpStatusInterceptor = () => {
  // Import dynamically to avoid module resolution issues
  const {HttpStatusInterceptor: HSI} = require('@webex/http-core');

  return HSI.create({
    error: WebexHttpError,
  });
};

// TODO replace the Interceptor.create with Reflect.construct (
// Interceptor.create exists because new was really hard to call on an array of
// constructors)
const interceptors = {
  WebexTrackingIdInterceptor: WebexTrackingIdInterceptor.create,
  RequestEventInterceptor: RequestEventInterceptor.create,
  RateLimitInterceptor: RateLimitInterceptor.create,
  /* eslint-disable no-extra-parens */
  RequestLoggerInterceptor:
    process.env.ENABLE_NETWORK_LOGGING || process.env.ENABLE_VERBOSE_NETWORK_LOGGING
      ? RequestLoggerInterceptor.create
      : undefined,
  ResponseLoggerInterceptor:
    process.env.ENABLE_NETWORK_LOGGING || process.env.ENABLE_VERBOSE_NETWORK_LOGGING
      ? ResponseLoggerInterceptor.create
      : undefined,
  /* eslint-enable no-extra-parens */
  RequestTimingInterceptor: RequestTimingInterceptor.create,
  ServiceInterceptor: undefined,
  UserAgentInterceptor: UserAgentInterceptor.create,
  ProxyInterceptor: ProxyInterceptor.create,
  WebexUserAgentInterceptor: WebexUserAgentInterceptor.create,
  AuthInterceptor: AuthInterceptor.create,
  KmsDryErrorInterceptor: undefined,
  PayloadTransformerInterceptor: PayloadTransformerInterceptor.create,
  ConversationInterceptor: undefined,
  RedirectInterceptor: RedirectInterceptor.create,
  HttpStatusInterceptor: createHttpStatusInterceptor,
  NetworkTimingInterceptor: NetworkTimingInterceptor.create,
  EmbargoInterceptor: EmbargoInterceptor.create,
  DefaultOptionsInterceptor: DefaultOptionsInterceptor.create,
  HostMapInterceptor: HostMapInterceptor.create,
};

const preInterceptors = [
  'ResponseLoggerInterceptor',
  'RequestTimingInterceptor',
  'RequestEventInterceptor',
  'WebexTrackingIdInterceptor',
  'RateLimitInterceptor',
];

const postInterceptors = [
  'HttpStatusInterceptor',
  'NetworkTimingInterceptor',
  'EmbargoInterceptor',
  'RequestLoggerInterceptor',
  'RateLimitInterceptor',
];

const MAX_FILE_SIZE_IN_MB = 2048;

/**
 * @class WebexCore
 *
 * Modern TypeScript implementation using pure class-based architecture with async initialization.
 * This class manages plugin registration, instantiation, and lifecycle using promises instead
 * of complex event-driven ready state monitoring.
 *
 * PLUGIN SYSTEM OVERVIEW:
 *
 * The WebexCore uses a plugin-based architecture where functionality is organized into
 * discrete plugins (e.g., meetings, messaging, device management). The system works in
 * three main phases:
 *
 * 1. REGISTRATION PHASE (build time):
 *    - Plugins call registerPlugin() or registerInternalPlugin()
 *    - Plugin constructors are stored in _children collections on prototype
 *    - This happens when modules are imported/required
 *
 * 2. INSTANTIATION PHASE (runtime - during WebexCore construction):
 *    - Constructor creates plugin instances synchronously
 *    - Plugins become available as webex.pluginName and webex.internal.pluginName immediately
 *    - No complex ready state monitoring needed
 *
 * 3. INITIALIZATION PHASE (runtime - async after instantiation):
 *    - Call webex.initialize() to start async setup
 *    - Each plugin's initialize() method is called with config
 *    - Returns a promise that resolves when all plugins are initialized
 *    - Simple promise-based lifecycle instead of event-driven ready states
 */
class WebexCore extends WebexState {
  static version = PACKAGE_VERSION;
  version = PACKAGE_VERSION;

  // Core WebexCore components
  internal: WebexInternalCore; // Internal plugins (webex.internal.*)
  config: WebexCoreConfig; // SDK configuration
  private _loaded = false; // Storage loading complete flag (private)
  private _boundedStorage: any; // Cached bounded storage instance
  private _unboundedStorage: any; // Cached unbounded storage instance
  request: any; // HTTP request function with interceptors
  sessionId: string; // Unique session identifier
  prepareFetchOptions: any; // Fetch options preparation function
  setTimingsAndFetch: any; // Timing and fetch wrapper function

  // Getter and setter for loaded property that emits events
  get loaded(): boolean {
    return this._loaded;
  }

  set loaded(value: boolean) {
    const oldValue = this._loaded;
    this._loaded = value;
    if (oldValue !== value) {
      // Emit the change event for the listener that was set up in initialize()
      (this as any).emit('change:loaded', value);

      // If we're setting to true, also emit the 'loaded' event directly
      if (value === true) {
        (this as any).emit('loaded');
      }
    }
  }

  // Properties from plugins that may be attached dynamically
  // These become available after plugin instantiation:
  credentials?: any; // webex.credentials (authentication)
  authorization?: any; // webex.authorization (OAuth flow)
  logger?: any; // webex.logger (logging)
  metrics?: any; // webex.metrics (telemetry)
  meetings?: any; // webex.meetings (meeting functionality)
  messages?: any; // webex.messages (messaging functionality)
  // ... other plugins get attached here dynamically

  /**
   * Direct access to credentials.canAuthorize - modern replacement for proxy system
   * @returns {boolean} Whether this instance can authorize requests
   */
  get canAuthorize(): boolean {
    return this.credentials?.canAuthorize ?? false;
  }

  /**
   * Direct access to credentials.canRefresh - modern replacement for proxy system
   * @returns {boolean} Whether this instance can refresh tokens
   */
  get canRefresh(): boolean {
    return this.credentials?.canRefresh ?? false;
  }

  // Note: EventEmitter methods (emit, on, once, etc.) are inherited from
  // WebexState -> WebexEventEmitter -> EventEmitter and should be available at runtime

  // Store processed attributes for plugin creation
  private attrs: WebexCoreOptions = {};

  constructor(attrs: WebexCoreOptions | string = {}, options?: any) {
    // Process credential attributes before calling super
    const processedAttrs = WebexCore.processCredentialAttributes(attrs);

    // Call super() with processed attributes to properly initialize WebexState and EventEmitter chain
    super(processedAttrs);

    // Store processed attributes for plugin creation AFTER super()
    this.attrs = processedAttrs;

    // Initialize basic properties FIRST
    this.loaded = false;
    this.sessionId = '';

    // CRITICAL: Merge all config sources in the correct order:
    // 1. Default config (from packages/@webex/webex-core/src/config.js)
    // 2. Plugin registration configs (from pluginRegistry.getConfig())
    // 3. Runtime config (passed to WebexCore constructor)
    this.config = merge(
      {},
      config, // 1. SDK default config
      pluginRegistry.getConfig(), // 2. Plugin registration configs
      processedAttrs.config || {} // 3. Runtime config (highest priority)
    );

    (this as any).emit('change:config', this.config);

    // CRITICAL FIX: Merge plugin interceptors into the global interceptors object
    // This was done by the old mixinWebexCorePlugins() function
    const pluginInterceptors = pluginRegistry.getInterceptors();
    Object.keys(pluginInterceptors).forEach((key) => {
      interceptors[key] = pluginInterceptors[key];
    });

    // Set up HTTP client and interceptors FIRST (like old WebexCore)
    // This is critical - plugins need access to this.request() immediately
    this._setupHttpClient();
    this._generateSessionId();

    // Create WebexInternalCore instance - this is just a namespace for internal plugins
    this.internal = new WebexInternalCore(processedAttrs, options);

    // CRITICAL: Create plugins first but delay initialization to nextTick
    // This matches the old ampstate timing exactly
    if (this._shouldInitializePlugins()) {
      this._createPluginInstances();
      this._setupEventForwarding();
    }

    // Use nextTick to delay initialization like the old WebexCore
    // This allows plugins to be fully constructed before any async initialization starts
    process.nextTick(() => {
      this.initialize(processedAttrs);
    });
  }

  /**
   * Process credential attributes to handle various input formats
   * Extracted from constructor to match old WebexCore pattern
   * Made static to allow calling before super()
   */
  private static processCredentialAttributes(attrs: WebexCoreOptions | string): WebexCoreOptions {
    // Handle string input (access token) - convenience for simple authentication
    if (typeof attrs === 'string') {
      return {
        credentials: {
          supertoken: {
            // eslint-disable-next-line camelcase
            access_token: attrs,
          },
        },
      };
    }

    // Handle various credential formats
    const processedAttrs = {...attrs}; // Clone to avoid mutations

    // Reminder: order is important here
    [
      'credentials.authorization',
      'authorization',
      'credentials.supertoken.supertoken',
      'supertoken',
      'access_token',
      'credentials.authorization.supertoken',
    ].forEach((path) => {
      const val = get(processedAttrs as any, path);

      if (val) {
        unset(processedAttrs as any, path);
        set(processedAttrs as any, 'credentials.supertoken', val);
      }
    });

    ['credentials', 'credentials.authorization'].forEach((path) => {
      const val = get(processedAttrs as any, path);

      if (typeof val === 'string') {
        unset(processedAttrs as any, path);
        set(processedAttrs as any, 'credentials.supertoken', val);
      }
    });

    if (typeof get(processedAttrs as any, 'credentials.access_token') === 'string') {
      // Send access_token to get validated and corrected and then set it
      set(
        processedAttrs as any,
        'credentials.access_token',
        WebexCore.bearerValidator(get(processedAttrs as any, 'credentials.access_token').trim())
      );

      set(processedAttrs as any, 'credentials.supertoken', (processedAttrs as any).credentials);
    }

    return processedAttrs;
  }

  /**
   * Initializer - matches the old webex-core pattern exactly
   *
   * CRITICAL: This now runs AFTER plugins are created (like old WebexCore)
   * The sequence is: constructor -> create plugins -> initialize() -> initialize plugins
   *
   * @emits WebexCore#loaded
   * @emits WebexCore#ready
   * @instance
   * @memberof WebexCore
   * @param {WebexCoreOptions} attrs Configuration attributes
   * @returns {void}
   */
  initialize(attrs: WebexCoreOptions = {}): void {
    // Initialize all plugins - HTTP client already set up in constructor
    this._initializePlugins()
      .then(() => {
        console.debug('WebexCore: All plugins initialized');

        // Mark storage as loaded AFTER plugin initialization
        this.loaded = true;

        // Check overall ready state after everything is set up
        this._checkOverallReadyState();
      })
      .catch((error) => {
        console.error('WebexCore: Plugin initialization error:', error);
        // Still mark as loaded and check ready state even if some plugins failed
        this.loaded = true;
        this._checkOverallReadyState();
      });
  }

  /**
   * Storage getters with truly lazy initialization matching old WebexCore behavior
   * Storage is only created when accessed, regardless of loaded state
   * This matches the old Ampersand derived property behavior exactly
   */
  get boundedStorage() {
    // Create storage lazily on first access (like old Ampersand derived properties)
    if (!this._boundedStorage) {
      this._boundedStorage = makeWebexStore('bounded', this);
    }

    return this._boundedStorage;
  }

  get unboundedStorage() {
    // Create storage lazily on first access (like old Ampersand derived properties)
    if (!this._unboundedStorage) {
      this._unboundedStorage = makeWebexStore('unbounded', this);
    }

    return this._unboundedStorage;
  }

  /**
   * Legacy ready getter for backward compatibility - checks if all plugins are ready
   */
  get ready(): boolean {
    if (!this.loaded) {
      return false;
    }

    // Check if all plugins with a ready property are ready
    const children = (this.constructor as any).prototype._children || {};
    const pluginNames = Object.keys(children);

    for (const name of pluginNames) {
      const plugin = this[name];
      if (plugin && typeof plugin.ready !== 'undefined' && !plugin.ready) {
        return false;
      }
    }

    // Check internal plugins too
    if (this.internal) {
      const internalChildren = (this.internal.constructor as any).prototype._children || {};
      const internalPluginNames = Object.keys(internalChildren);

      for (const name of internalPluginNames) {
        const plugin = this.internal[name];
        if (plugin && typeof plugin.ready !== 'undefined' && !plugin.ready) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * @instance
   * @memberof WebexCore
   * @param {...any} args
   * @returns {Promise<any>}
   */
  refresh(...args: any[]): Promise<any> {
    return this.credentials?.refresh(...args) || Promise.resolve();
  }

  /**
   * Applies the directionally appropriate transforms to the specified object
   * @param {string} direction
   * @param {any} object
   * @returns {Promise<any>}
   */
  transform(direction: string, object: any): Promise<any> {
    const predicates =
      this.config.payloadTransformer?.predicates?.filter(
        (p) => !p.direction || p.direction === direction
      ) || [];
    const ctx = {
      webex: this,
    };

    return Promise.all(
      predicates.map((p) =>
        p.test(ctx, object).then((shouldTransform) => {
          if (!shouldTransform) {
            return undefined;
          }

          return (
            p
              .extract(object)
              // eslint-disable-next-line max-nested-callbacks
              .then((target) => ({
                name: p.name,
                target,
                alias: undefined as string | undefined,
              }))
          );
        })
      )
    )
      .then((data) =>
        data
          .filter((d) => Boolean(d))
          // eslint-disable-next-line max-nested-callbacks
          .reduce(
            (promise, {name, target, alias}) =>
              promise.then(() => {
                if (alias) {
                  return this.applyNamedTransform(direction, alias, target);
                }

                return this.applyNamedTransform(direction, name, target);
              }),
            Promise.resolve()
          )
      )
      .then(() => object);
  }

  /**
   * Applies the directionally appropriate transform to the specified parameters
   * @param {string} direction
   * @param {any} ctx
   * @param {string} name
   * @param {...any} rest
   * @returns {Promise<any>}
   */
  applyNamedTransform(direction: string, ctx: any, name?: string, ...rest: any[]): Promise<any> {
    if (isString(ctx)) {
      rest.unshift(name);
      name = ctx;
      ctx = {
        webex: this,
        transform: (...args: any[]) => this.applyNamedTransform(direction, ctx, ...args),
      };
    }

    const transforms =
      ctx.webex.config.payloadTransformer?.transforms?.filter(
        (tx: Transform) => tx.name === name && (!tx.direction || tx.direction === direction)
      ) || [];

    // too many implicit returns on the same line is difficult to interpret
    // eslint-disable-next-line arrow-body-style
    return transforms
      .reduce(
        (promise: Promise<any>, tx: Transform) =>
          promise.then(() => {
            if (tx.alias) {
              return ctx.transform(tx.alias, ...rest);
            }

            return Promise.resolve(tx.fn(ctx, ...rest));
          }),
        Promise.resolve()
      )
      .then(() => last(rest));
  }

  /**
   * @private
   * @returns {Window}
   */
  getWindow(): Window {
    // eslint-disable-next-line
    return window;
  }

  /**
   * Determines whether this WebexCore instance should initialize plugins
   * Only the main Webex object should initialize plugins, not individual plugins or internal components
   * @private
   * @returns {boolean}
   */
  private _shouldInitializePlugins(): boolean {
    // STRATEGY: Only initialize plugins for the main Webex instance

    // Method 1: Check for main Webex class characteristics
    // The main Webex class (in packages/webex/src/webex.js) sets this.webex = true
    if ((this as any).webex === true) {
      return true;
    }

    // Method 2: Check if this is NOT a plugin instance
    // Plugins have a parent and namespace, main Webex object doesn't
    if ((this as any).parent || (this as any).namespace) {
      return false;
    }

    // Method 3: Check inheritance chain
    // Main Webex class extends WebexCore directly, plugins extend WebexPlugin
    const constructorName = this.constructor.name;
    if (constructorName === 'Webex' || constructorName.endsWith('Webex')) {
      return true;
    }

    // Method 4: Default for backward compatibility
    // If we can't determine, err on the side of initializing for legacy support
    // But only if there are actually plugins registered
    const children = (this.constructor as any).prototype._children || {};
    const hasRegisteredPlugins = Object.keys(children).length > 0;

    return hasRegisteredPlugins;
  }

  /**
   * Create plugin instances synchronously - they become available immediately
   * This replaces the complex async initialization with simple synchronous instantiation
   * @private
   */
  private _createPluginInstances(): void {
    console.debug(`WebexCore: Creating plugin instances for ${this.constructor.name}`);

    // Get the processed attributes from the constructor (stored in this.attrs or similar)
    const processedAttrs = this.attrs || {};

    // Create regular plugins (webex.meetings, webex.messages, etc.)
    const children = (this.constructor as any).prototype._children || {};
    console.debug(
      `WebexCore: Found ${Object.keys(children).length} registered plugins:`,
      Object.keys(children)
    );

    Object.keys(children).forEach((name) => {
      if (!this[name]) {
        const ChildConstructor = children[name];
        try {
          // Extract plugin-specific attributes from processedAttrs
          // Each plugin should only receive attrs[pluginName] or empty object if not present
          const pluginAttrs = processedAttrs[name] || {};

          console.debug(
            `WebexCore: Passing plugin-specific attrs to plugin '${name}':`,
            pluginAttrs
          );

          this[name] = new ChildConstructor(pluginAttrs, {
            parent: this,
            webex: this,
            namespace: name,
          });

          // Listen for plugin ready state changes
          const plugin = this[name];
          if (
            plugin &&
            typeof plugin.ready !== 'undefined' &&
            !plugin.ready &&
            typeof plugin.on === 'function'
          ) {
            console.debug(`WebexCore: Setting up ready listener for plugin '${name}'`);
            plugin.on('change:ready', () => {
              this._checkOverallReadyState();
            });
          }

          console.debug(`WebexCore: Created plugin instance '${name}' -> webex.${name}`);
        } catch (error) {
          console.error(`WebexCore: Failed to create plugin '${name}':`, error);
        }
      }
    });

    // Create internal plugins (webex.internal.dss, webex.internal.device, etc.)
    if (this.internal) {
      const internalChildren = (this.internal.constructor as any).prototype._children || {};
      console.debug(
        `WebexCore: Found ${Object.keys(internalChildren).length} registered internal plugins:`,
        Object.keys(internalChildren)
      );

      Object.keys(internalChildren).forEach((name) => {
        if (!this.internal[name]) {
          const ChildConstructor = internalChildren[name];
          try {
            // Extract plugin-specific attributes from processedAttrs for internal plugins too
            // Each internal plugin should only receive attrs[pluginName] or empty object if not present
            const pluginAttrs = processedAttrs[name] || {};

            console.debug(
              `WebexCore: Passing plugin-specific attrs to internal plugin '${name}':`,
              pluginAttrs
            );

            this.internal[name] = new ChildConstructor(pluginAttrs, {
              parent: this.internal,
              webex: this,
              namespace: name,
            });

            // Listen for plugin ready state changes
            const plugin = this.internal[name];
            if (
              plugin &&
              typeof plugin.ready !== 'undefined' &&
              !plugin.ready &&
              typeof plugin.on === 'function'
            ) {
              console.debug(`WebexCore: Setting up ready listener for internal plugin '${name}'`);
              plugin.on('change:ready', () => {
                this._checkOverallReadyState();
              });
            }

            console.debug(
              `WebexCore: Created internal plugin instance '${name}' -> webex.internal.${name}`
            );
          } catch (error) {
            console.error(`WebexCore: Failed to create internal plugin '${name}':`, error);
          }
        }
      });
    }

    console.debug('WebexCore: Plugin instance creation complete');
  }

  /**
   * Set up HTTP client with interceptors - moved from initialize()
   * @private
   */
  private _setupHttpClient(): void {
    const addInterceptor = (ints: any[], key: string) => {
      const interceptorsObj = this.config.interceptors || interceptors;
      const interceptor = interceptorsObj[key];

      if (!isFunction(interceptor)) {
        return ints;
      }

      ints.push(Reflect.apply(interceptor, this, []));

      return ints;
    };

    let ints: any[] = [];

    if (this.config.interceptors) {
      Object.keys(this.config.interceptors).reduce(addInterceptor, ints);
    } else {
      ints = preInterceptors.reduce(addInterceptor, ints);
      ints = Object.keys(interceptors)
        .filter((key) => !(preInterceptors.includes(key) || postInterceptors.includes(key)))
        .reduce(addInterceptor, ints);
      ints = postInterceptors.reduce(addInterceptor, ints);
    }

    this.request = requestDefaults({
      json: true,
      interceptors: ints,
    });

    this.prepareFetchOptions = prepareFetchOptions({
      json: true,
      interceptors: ints,
    });

    this.setTimingsAndFetch = _setTimingsAndFetch;
  }

  /**
   * Generate session ID - moved from initialize()
   * @private
   */
  private _generateSessionId(): void {
    let sessionId = `${get(this, 'config.trackingIdPrefix', 'webex-js-sdk')}_${get(
      this,
      'config.trackingIdBase',
      uuid.v4()
    )}`;

    if (get(this, 'config.trackingIdSuffix')) {
      sessionId += `_${get(this, 'config.trackingIdSuffix')}`;
    }

    this.sessionId = sessionId;
  }

  /**
   * Check if all plugins are ready and emit ready if overall state changed to ready
   * @private
   */
  private _checkOverallReadyState(): void {
    if (this.ready) {
      (this as any).emit('ready');
    }
  }

  /**
   * Initialize all plugins by calling their initialize() method if it exists
   * This should be called after all plugins are constructed
   *
   * COMMENTED OUT: Plugin initialize() is now called in WebexPlugin constructor
   * to fix decorator timing issues. The decorators need to wrap this.webex.initialize
   * BEFORE WebexCore calls its own initialize() method for proper storage loading.
   * @private
   * @returns {Promise<void>}
   */
  private async _initializePlugins(): Promise<void> {
    console.debug(
      'WebexCore: Plugin initialization now happens in constructors (decorator timing fix)'
    );

    // COMMENTED OUT: Plugins now call initialize() in their constructor
    // This fixes the decorator timing issue where @persist and @waitForValue decorators
    // need to wrap this.webex.initialize before WebexCore calls its own initialize()

    /*
    console.debug('WebexCore: Starting plugin initialization');

    const initPromises: Promise<any>[] = [];

    // Initialize regular plugins
    const children = (this.constructor as any).prototype._children || {};
    Object.keys(children).forEach((name) => {
      const plugin = this[name];
      if (plugin && typeof plugin.initialize === 'function') {
        console.debug(`WebexCore: Initializing plugin '${name}'`);
        initPromises.push(
          Promise.resolve(plugin.initialize()).catch((error) => {
            console.error(`WebexCore: Plugin '${name}' initialization failed:`, error);
          })
        );
      }
    });

    // Initialize internal plugins
    if (this.internal) {
      const internalChildren = (this.internal.constructor as any).prototype._children || {};
      Object.keys(internalChildren).forEach((name) => {
        const plugin = this.internal[name];
        if (plugin && typeof plugin.initialize === 'function') {
          console.debug(`WebexCore: Initializing internal plugin '${name}'`);
          initPromises.push(
            Promise.resolve(plugin.initialize()).catch((error) => {
              console.error(`WebexCore: Internal plugin '${name}' initialization failed:`, error);
            })
          );
        }
      });
    }

    if (initPromises.length > 0) {
      await Promise.all(initPromises);
      console.debug(`WebexCore: Completed initialization of ${initPromises.length} plugins`);
    } else {
      console.debug('WebexCore: No plugins with initialize() method found');
    }
    */
  }

  /**
   * Set up event forwarding from plugins to core
   * @private
   */
  private _setupEventForwarding(): void {
    // Forward plugin change events to core for backward compatibility
    Object.keys((this.constructor as any).prototype._children || {}).forEach((key) => {
      const plugin = this[key];
      if (plugin && typeof plugin.on === 'function') {
        plugin.on('change', (...args: any[]) => {
          args.unshift(`change:${key}`);
          (this as any).emit(...args);
        });
      }
    });
  }

  /**
   * setConfig
   *
   * Allows updating config - plugins automatically see changes via their config getter
   *
   * @instance
   * @memberof WebexCore
   * @param {Partial<WebexCoreConfig>} newConfig - New config to merge
   * @returns {void}
   */
  setConfig(newConfig: Partial<WebexCoreConfig> = {}): void {
    const oldConfig = this.config;
    this.config = merge({}, this.config, newConfig);

    // Emit config change event so plugins can react if they need to
    (this as any).emit('change:config', this.config, oldConfig);
  }

  /**
   *
   * Check if access token is correctly formated and correct if it's not
   * Warn user if token string has errors in it
   * @param {string} token
   * @returns {string}
   */
  static bearerValidator(token: string): string {
    if (token.includes('Bearer') && token.split(' ').length - 1 === 0) {
      console.warn(
        `Your access token does not have a space between 'Bearer' and the token, please add a space to it or replace it with this already fixed version:\n\n${token
          .replace('Bearer', 'Bearer ')
          .replace(/\s+/g, ' ')}`
      );
      console.info(
        "Tip: You don't need to add 'Bearer' to the access_token field. The token by itself is fine"
      );

      return token.replace('Bearer', 'Bearer ').replace(/\s+/g, ' ');
    }
    // Allow elseIf return
    // eslint-disable-next-line  no-else-return
    else if (token.split(' ').length - 1 > 1) {
      console.warn(
        `Your access token has ${
          token.split(' ').length - 2
        } too many spaces, please use this format:\n\n${token.replace(/\s+/g, ' ')}`
      );
      console.info(
        "Tip: You don't need to add 'Bearer' to the access_token field, the token by itself is fine"
      );

      return token.replace(/\s+/g, ' ');
    }

    return token.replace(/\s+/g, ' '); // Clean it anyway (just in case)
  }

  /**
   * @instance
   * @memberof WebexCore
   * @param {number} depth
   * @private
   * @returns {string}
   */
  inspect(depth?: number): string {
    return util.inspect(
      omit(this.toJSON?.() || {}, 'boundedStorage', 'unboundedStorage', 'request', 'config'),
      {depth}
    );
  }

  /**
   * Serialize method that mimics Ampersand behavior
   */
  toJSON(): any {
    return {
      version: this.version,
      loaded: this.loaded,
      sessionId: this.sessionId,
    };
  }

  /**
   * Invokes all `onBeforeLogout` handlers in the scope of their plugin, clears
   * all stores, and revokes the access token
   * Note: If you're using the sdk in a server environment, you may be more
   * interested in {@link `webex.internal.mercury.disconnect()`| Mercury#disconnect()}
   * and {@link `webex.internal.device.unregister()`|Device#unregister()}
   * or {@link `webex.phone.unregister()`|Phone#unregister}
   * @instance
   * @memberof WebexCore
   * @param {any} options Passed as the first argument to all
   * `onBeforeLogout` handlers
   * @param {...any} rest
   * @returns {Promise<void>}
   */
  logout(options?: any, ...rest: any[]): Promise<void> {
    // prefer the refresh token, but for clients that don't have one, fallback
    // to the access token
    const token =
      this.credentials?.supertoken &&
      (this.credentials.supertoken.refresh_token || this.credentials.supertoken.access_token);

    options = {token, ...options};

    // onBeforeLogout should be executed in the opposite order in which handlers
    // were registered. In that way, wdm unregister() will be above mercury
    // disconnect(), but disconnect() will execute first.
    // eslint-disable-next-line arrow-body-style
    return (this.config.onBeforeLogout || [])
      .reverse()
      .reduce(
        (promise: Promise<any>, {plugin, fn}: {plugin: string; fn: Function}) =>
          promise.then(() => {
            return (
              Promise.resolve(
                Reflect.apply(fn, this[plugin] || this.internal[plugin], [options, ...rest])
              )
                // eslint-disable-next-line max-nested-callbacks
                .catch((err) => {
                  this.logger?.warn(`onBeforeLogout from plugin ${plugin}: failed`, err);
                })
            );
          }),
        Promise.resolve()
      )
      .then(() => Promise.all([this.boundedStorage.clear(), this.unboundedStorage.clear()]))
      .then(() => this.credentials?.invalidate(...rest))
      .then(
        () =>
          this.authorization &&
          this.authorization.logout &&
          this.authorization.logout(options, ...rest)
      )
      .then(() => (this as any).emit('client:logout'));
  }

  /**
   * General purpose wrapper to submit metrics via the metrics plugin (if the
   * metrics plugin is installed)
   * @instance
   * @memberof WebexCore
   * @param {...any} args
   * @returns {Promise<any>}
   */
  measure(...args: any[]): Promise<any> {
    if (this.metrics) {
      return this.metrics.sendUnstructured(...args);
    }

    return Promise.resolve();
  }

  /**
   * Uploads a file provided in `file` property
   *
   * @param {UploadOptions} options
   * @returns {Promise<any>}
   */
  upload(options: UploadOptions): Promise<any> {
    if (!options || !options.file) {
      return Promise.reject(new Error('`options.file` is required'));
    }

    options.phases = options.phases || {};
    options.phases.initialize = options.phases.initialize || {};
    options.phases.upload = options.phases.upload || {};
    options.phases.finalize = options.phases.finalize || {};

    defaultsDeep(
      options.phases.initialize,
      {
        method: 'POST',
        body: {
          uploadProtocol: 'content-length',
        },
      },
      omit(options, 'file', 'phases')
    );

    defaultsDeep(options.phases.upload, {
      method: 'PUT',
      json: false,
      withCredentials: false,
      body: options.file,
      headers: {
        'x-trans-id': uuid.v4(),
        authorization: undefined,
      },
    });

    defaultsDeep(
      options.phases.finalize,
      {
        method: 'POST',
      },
      omit(options, 'file', 'phases')
    );

    const shunt = new EventEmitter();

    const promise = this._uploadPhaseInitialize(options)
      .then(() => {
        const p = this._uploadPhaseUpload(options);

        transferEvents('progress', p, shunt);

        return p;
      })
      .then((res: any) => this._uploadPhaseFinalize(options))
      .then((res) => ({...res.body, ...res.headers}));

    proxyEvents(shunt, promise);

    return promise;
  }

  private _uploadPhaseInitialize(options: UploadOptions): Promise<any> {
    this.logger?.debug('client: initiating upload session');

    return this.request(options.phases!.initialize)
      .then((...args: any[]) => {
        const fileUploadSizeLimitInBytes =
          (args[0].body.fileUploadSizeLimit || MAX_FILE_SIZE_IN_MB) * 1024 * 1024;
        const currentFileSizeInBytes = options.file.byteLength;

        if (fileUploadSizeLimitInBytes && fileUploadSizeLimitInBytes < currentFileSizeInBytes) {
          return this._uploadAbortSession(currentFileSizeInBytes, args[0]);
        }

        return this._uploadApplySession(options, args[0]);
      })
      .then((res: any) => {
        this.logger?.debug('client: initiated upload session');

        return res;
      });
  }

  private _uploadAbortSession(currentFileSizeInBytes: number, response: any): Promise<never> {
    this.logger?.debug('client: deleting uploaded file');

    return this.request({
      method: 'DELETE',
      url: response.body.url,
      headers: response.options.headers,
    }).then(() => {
      this.logger?.debug('client: deleting uploaded file complete');

      const abortErrorDetails = {
        currentFileSizeInBytes,
        fileUploadSizeLimitInMB: response.body.fileUploadSizeLimit || MAX_FILE_SIZE_IN_MB,
        message: 'file-upload-size-limit-enabled',
      };

      return Promise.reject(new Error(`${JSON.stringify(abortErrorDetails)}`));
    });
  }

  private _uploadApplySession(options: UploadOptions, res: any): void {
    const session = res.body;

    ['upload', 'finalize'].reduce((opts, key) => {
      opts[key] = Object.keys(opts[key]).reduce((phaseOptions: any, phaseKey: string) => {
        if (phaseKey.startsWith('$')) {
          phaseOptions[phaseKey.substr(1)] = phaseOptions[phaseKey](session);
          Reflect.deleteProperty(phaseOptions, phaseKey);
        }

        return phaseOptions;
      }, opts[key]);

      return opts;
    }, options.phases!);
  }

  @retry
  private _uploadPhaseUpload(options: UploadOptions): Promise<any> {
    this.logger?.debug('client: uploading file');

    const promise = this.request(options.phases!.upload).then((res: any) => {
      this.logger?.debug('client: uploaded file');

      return res;
    });

    proxyEvents(options.phases!.upload.upload, promise);

    /* istanbul ignore else */
    if (process.env.NODE_ENV === 'test') {
      promise.on('progress', (event: any) => {
        this.logger?.info('upload progress', event.loaded, event.total);
      });
    }

    return promise;
  }

  private _uploadPhaseFinalize(options: UploadOptions): Promise<any> {
    this.logger?.debug('client: finalizing upload session');

    return this.request(options.phases!.finalize).then((res: any) => {
      this.logger?.debug('client: finalized upload session');

      return res;
    });
  }
}

export default WebexCore;

/**
 * @method registerPlugin
 * @param {string} name
 * @param {Function} constructor
 * @param {any} options
 * @param {Array<string>} options.proxies
 * @param {any} options.interceptors
 * @returns {void}
 */
export function registerPlugin(name: string, constructor: Function, options: any = {}): void {
  // CRITICAL: Pass WebexCore as targetClass so plugins get stored in _children collection
  // This is what allows _initializePlugins() to find and instantiate them
  pluginRegistry.registerPlugin(name, constructor, WebexCore, options);

  console.debug(`Plugin Registry: Registered plugin '${name}' with WebexCore`);
}

/**
 * Registers plugins used by internal products that do not talk to public APIs.
 * @method registerInternalPlugin
 * @param {string} name
 * @param {Function} constructor
 * @param {any} options
 * @param {any} options.interceptors
 * @private
 * @returns {void}
 */
export function registerInternalPlugin(name: string, constructor: Function, options?: any): void {
  // CRITICAL: Pass WebexInternalCore as targetClass so plugins get stored in _children collection
  // This is what allows _initializePlugins() to find and instantiate them
  pluginRegistry.registerInternalPlugin(name, constructor, WebexInternalCore, options || {});

  console.debug(`Plugin Registry: Registered internal plugin '${name}' with WebexInternalCore`);
}
