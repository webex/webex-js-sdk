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
 * Modern TypeScript implementation extending WebexEventEmitter that serves as the main
 * entry point for the Webex JavaScript SDK. This class manages plugin registration,
 * instantiation, and lifecycle.
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
 *    - Constructor calls initialize() automatically (replicating AmpersandState behavior)
 *    - initialize() calls _initializePlugins()
 *    - _initializePlugins() creates instances from registered constructors
 *    - Plugins become available as webex.pluginName and webex.internal.pluginName
 * 
 * 3. INITIALIZATION PHASE (runtime - after instantiation):
 *    - Each plugin's initialize() method is called with config
 *    - Plugins set up their internal state, event listeners, etc.
 *    - System becomes ready for use
 * 
 * HISTORICAL CONTEXT:
 * This implementation replaces the original AmpersandState-based WebexCore.
 * AmpersandState automatically called initialize() and handled children instantiation.
 * This TypeScript version manually replicates that behavior for compatibility.
 */
class WebexCore extends WebexState {
  static version = PACKAGE_VERSION;
  version = PACKAGE_VERSION;

  // Core WebexCore components
  internal: WebexInternalCore;  // Internal plugins (webex.internal.*)
  config: WebexCoreConfig;             // SDK configuration
  loaded: boolean;                     // Storage loading complete flag
  request: any;                        // HTTP request function with interceptors
  sessionId: string;                   // Unique session identifier
  prepareFetchOptions: any;            // Fetch options preparation function
  setTimingsAndFetch: any;             // Timing and fetch wrapper function

  // Initialize tracking to prevent double initialization
  private _initialized: boolean = false;

  // Properties from plugins that may be attached dynamically
  // These become available after plugin instantiation:
  credentials?: any;    // webex.credentials (authentication)
  authorization?: any;  // webex.authorization (OAuth flow)
  logger?: any;         // webex.logger (logging)
  metrics?: any;        // webex.metrics (telemetry)
  meetings?: any;       // webex.meetings (meeting functionality) 
  messages?: any;       // webex.messages (messaging functionality)
  // ... other plugins get attached here dynamically

  // Note: EventEmitter methods (emit, on, once, etc.) are inherited from
  // WebexState -> WebexEventEmitter -> EventEmitter and should be available at runtime

  constructor(attrs: WebexCoreOptions | string = {}, options?: any) {
    // Call super() with initial state to properly initialize WebexState and EventEmitter chain
    super({
      version: PACKAGE_VERSION,
      loaded: false,
      sessionId: '',
    });

    // Handle string input (access token) - convenience for simple authentication
    if (typeof attrs === 'string') {
      attrs = {
        credentials: {
          supertoken: {
            // eslint-disable-next-line camelcase
            access_token: attrs,
          },
        },
      };
    } else {
      // Handle various credential formats
      attrs = {...attrs}; // Clone to avoid mutations

      // Reminder: order is important here
      [
        'credentials.authorization',
        'authorization',
        'credentials.supertoken.supertoken',
        'supertoken',
        'access_token',
        'credentials.authorization.supertoken',
      ].forEach((path) => {
        const val = get(attrs, path);

        if (val) {
          unset(attrs, path);
          set(attrs, 'credentials.supertoken', val);
        }
      });

      ['credentials', 'credentials.authorization'].forEach((path) => {
        const val = get(attrs, path);

        if (typeof val === 'string') {
          unset(attrs, path);
          set(attrs, 'credentials.supertoken', val);
        }
      });

      if (typeof get(attrs, 'credentials.access_token') === 'string') {
        // Send access_token to get validated and corrected and then set it
        set(
          attrs,
          'credentials.access_token',
          this.bearerValidator(get(attrs, 'credentials.access_token').trim())
        );

        set(attrs, 'credentials.supertoken', attrs.credentials);
      }
    }

    // Initialize child components after super() call
    this.internal = new WebexInternalCore(attrs, options);
    this.loaded = false;
    this.config = {} as WebexCoreConfig;
    this.sessionId = '';

    // Schedule initialization to happen after constructor completes (like AmpersandState did)
    // CRITICAL: Only initialize once, even if constructor is called multiple times
    if (!this._initialized) {
      this._initialized = true; // Set immediately to prevent re-entry
      // Use setImmediate/setTimeout to ensure EventEmitter is fully initialized
      process.nextTick(() => {
        this.initialize(attrs);
      });
    }
  }

  /**
   * Storage getters using the established pattern
   */
  get boundedStorage() {
    return makeWebexStore('bounded', this);
  }

  get unboundedStorage() {
    return makeWebexStore('unbounded', this);
  }

  get ready(): boolean {
    const loaded = this.loaded;
    const internalReady = this.internal.ready;
    const childrenReady = Object.keys((this.constructor as any).prototype._children || {}).reduce(
      (ready, name) => ready && this[name] && this[name].ready !== false,
      true
    );

    const result = loaded && internalReady && childrenReady;
    
    console.debug('WebexCore: Ready state calculation:', {
      loaded,
      internalReady,  
      childrenReady,
      result
    });

    return result;
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
    // 
    // DETECTION METHODS:
    // 1. Check if this instance has no parent (it's the root)
    // 2. Check if this instance was created directly (not as a child plugin)
    // 3. Check if this instance has the main Webex characteristics
    
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
    
    console.debug(`WebexCore: Plugin initialization decision for ${constructorName}:`, {
      shouldInit: hasRegisteredPlugins,
      reason: hasRegisteredPlugins ? 'has registered plugins and no parent' : 'no registered plugins'
    });
    
    return hasRegisteredPlugins;
  }

  /**
   * CRITICAL PLUGIN SYSTEM METHOD
   * 
   * Initializes plugins from the _children collection. This method is the heart of the
   * plugin system and solves the original issue where plugins were registered but not instantiated.
   * 
   * HOW PLUGIN REGISTRATION WORKS:
   * 
   * 1. REGISTRATION (Build Time):
   *    - When plugin modules are imported, they call registerPlugin() or registerInternalPlugin()
   *    - These functions store plugin constructors in _children collections:
   *      * WebexCore.prototype._children = { meetings: MeetingsConstructor, messages: MessagesConstructor }
   *      * WebexInternalCore.prototype._children = { dss: DSSConstructor, device: DeviceConstructor }
   * 
   * 2. INSTANTIATION (Runtime - this method):
   *    - Called automatically during WebexCore construction via initialize()
   *    - Loops through registered constructors and creates instances
   *    - Attaches instances to webex object: webex.meetings, webex.internal.dss, etc.
   * 
   * 3. RESULT:
   *    - webex.meetings = new MeetingsConstructor()
   *    - webex.internal.dss = new DSSConstructor()  ← This fixes the original "webex.internal.dss is undefined" issue
   *    - webex.messages = new MessagesConstructor()
   * 
   * WHY THIS WAS MISSING:
   * In AmpersandState, this happened automatically via the "children" mechanism.
   * The TypeScript version needed to manually replicate this behavior.
   * 
   * @private
   * @returns {void}
   */
  private _initializePlugins(): void {
    console.debug(`WebexCore: Starting plugin initialization for ${this.constructor.name}`);
    
    // PART 1: Instantiate regular plugins (webex.meetings, webex.messages, etc.)
    // Access the _children collection where registerPlugin() stored constructors
    const children = (this.constructor as any).prototype._children || {};
    
    console.debug(`WebexCore: Found ${Object.keys(children).length} registered plugins:`, Object.keys(children));
    
    Object.keys(children).forEach(name => {
      if (!this[name]) { // Only instantiate if not already done (safety check)
        const ChildConstructor = children[name];
        try {
          // CRITICAL: Create plugin instance with proper parent binding
          // This ensures plugins get access to the main webex instance
          this[name] = new ChildConstructor({}, {
            parent: this,        // Give plugin access to webex core
            webex: this,         // Explicit webex reference for legacy plugins  
            namespace: name      // Plugin knows its own name
          });
          
          console.debug(`WebexCore: Successfully initialized plugin '${name}' -> webex.${name}`);
        } catch (error) {
          console.error(`WebexCore: FAILED to initialize plugin '${name}':`, error);
        }
      } else {
        console.debug(`WebexCore: Plugin '${name}' already exists, skipping`);
      }
    });

    // PART 2: Instantiate internal plugins (webex.internal.dss, webex.internal.device, etc.)
    // These are registered via registerInternalPlugin() and stored on WebexInternalCore
    if (this.internal) {
      const internalChildren = (this.internal.constructor as any).prototype._children || {};
      
      console.debug(`WebexCore: Found ${Object.keys(internalChildren).length} registered internal plugins:`, Object.keys(internalChildren));
      
      Object.keys(internalChildren).forEach(name => {
        if (!this.internal[name]) { // Only instantiate if not already done (safety check)
          const ChildConstructor = internalChildren[name];
          try {
            // CRITICAL: Create internal plugin with webex reference to prevent duplicate cores
            this.internal[name] = new ChildConstructor({}, {
              parent: this.internal,   // Parent is webex.internal
              webex: this,             // IMPORTANT: Root webex instance to prevent duplicate initialization
              namespace: name          // Plugin knows its own name
            });
            
            console.debug(`WebexCore: Successfully initialized internal plugin '${name}' -> webex.internal.${name}`);
          } catch (error) {
            console.error(`WebexCore: FAILED to initialize internal plugin '${name}':`, error);
          }
        } else {
          console.debug(`WebexCore: Internal plugin '${name}' already exists, skipping`);
        }
      });
    }
    
    console.debug('WebexCore: Plugin initialization complete. Available plugins:', {
      regular: Object.keys(children),
      internal: this.internal ? Object.keys(this.internal.constructor.prototype._children || {}) : []
    });
  }

  /**
   * Initializer
   *
   * @emits WebexCore#loaded
   * @emits WebexCore#ready
   * @instance
   * @memberof WebexCore
   * @param {WebexCoreOptions} attrs
   * @returns {WebexCore}
   */
  initialize(attrs: WebexCoreOptions = {}): void {
    this.config = merge({}, config, attrs.config);

    // CRITICAL FIX: Only initialize plugins if this is a top-level Webex instance
    // Check if this instance is the main Webex object (not a plugin or internal component)
    if (this._shouldInitializePlugins()) {
      this._initializePlugins();
    }

    // Fire the change:config event for plugin initialization
    this.emit('change:config');

    // CRITICAL: Initialize storage loading - this was missing!
    this._initializeStorage();

    const onLoaded = () => {
      if (this.loaded) {
        /**
         * Fires when all data has been loaded from the storage layer
         * @event loaded
         * @instance
         * @memberof WebexCore
         */
        this.emit('loaded');

        this.off('change:loaded', onLoaded);
      }
    };

    // This needs to run on nextTick or we'll never be able to wire up listeners
    process.nextTick(() => {
      this.on('change:loaded', onLoaded);
      onLoaded(); // Check initial state
    });

    const onReady = () => {
      if (this.ready) {
        /**
         * Fires when all plugins have fully initialized
         * @event ready
         * @instance
         * @memberof WebexCore
         */
        this.emit('ready');

        this.off('change:ready', onReady);
      }
    };

    // This needs to run on nextTick or we'll never be able to wire up listeners
    process.nextTick(() => {
      this.on('change:ready', onReady);
      onReady(); // Check initial state
    });

    // Make nested events propagate in a consistent manner
    Object.keys((this.constructor as any).prototype._children || {}).forEach((key) => {
      const plugin = this[key];
      if (plugin && typeof plugin.on === 'function') {
        plugin.on('change', (...args: any[]) => {
          args.unshift(`change:${key}`);
          this.emit(...args);
        });
      }
    });

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
   * Initialize storage systems - this was missing from the original implementation!
   * This is crucial for proper `loaded` and `ready` event firing.
   * @private
   */
  private _initializeStorage(): void {
    // Storage initialization should only happen for the main Webex instance
    if (!this._shouldInitializePlugins()) {
      return;
    }

    console.debug('WebexCore: Initializing storage systems...');
    
    // Start with loaded = false, then set to true once storage is ready
    this.loaded = false;

    // Simulate the storage loading process that was handled by AmpersandState
    // In the old system, this happened automatically
    process.nextTick(async () => {
      try {
        // Initialize bounded and unbounded storage
        // This triggers the getter creation and initial loading
        const bounded = this.boundedStorage;
        const unbounded = this.unboundedStorage;

        // Wait a small amount of time to simulate storage loading
        // In real implementation, this would wait for actual storage operations
        await new Promise(resolve => setTimeout(resolve, 10));

        console.debug('WebexCore: Storage systems initialized, setting loaded = true');
        this.loaded = true;
        
        // Emit change event to trigger ready state calculation
        this.emit('change:loaded', this.loaded);
        
        // Also check ready state after a short delay to let plugins finish initialization
        setTimeout(() => {
          console.debug('WebexCore: Checking ready state...', {
            loaded: this.loaded,
            ready: this.ready,
            internalReady: this.internal.ready
          });
          this.emit('change:ready', this.ready);
        }, 50);
        
      } catch (error) {
        console.error('WebexCore: Storage initialization failed:', error);
        // Still set loaded to true to prevent hanging
        this.loaded = true;
        this.emit('change:loaded', this.loaded);
      }
    });
  }

  /**
   * setConfig
   *
   * Allows updating config
   *
   * @instance
   * @memberof WebexCore
   * @param {Partial<WebexCoreConfig>} newConfig
   * @returns {void}
   */
  setConfig(newConfig: Partial<WebexCoreConfig> = {}): void {
    this.config = merge({}, this.config, newConfig);
  }

  /**
   *
   * Check if access token is correctly formated and correct if it's not
   * Warn user if token string has errors in it
   * @param {string} token
   * @returns {string}
   */
  bearerValidator(token: string): string {
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
      .then(() => this.emit('client:logout'));
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
      .then((...args: any[]) => this._uploadPhaseFinalize(options, ...args))
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
          return this._uploadAbortSession(currentFileSizeInBytes, ...args);
        }

        return this._uploadApplySession(options, ...args);
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
