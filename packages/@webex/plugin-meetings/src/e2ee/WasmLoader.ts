/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import LoggerProxy from '../common/logs/logger-proxy';

const DEFAULT_WASM_URL = '/wasm/e2ee.wasm';

/**
 * The WebAssembly module produced by the e2ee module factory. The full WebE2EE surface is typed
 * in wasm.d.ts once the protocol engine lands; here we only need the module shape to cache it.
 */
export interface WebE2EEModule {
  WebE2EE: new () => unknown;
}

type ModuleFactory = (moduleOverrides?: {
  locateFile?: (path: string) => string;
}) => Promise<WebE2EEModule>;

type ModuleImporter = (jsPath: string) => Promise<{default: ModuleFactory}>;

const defaultImporter: ModuleImporter = (jsPath) => import(/* webpackIgnore: true */ jsPath);

/**
 * Loads and caches the e2ee WebAssembly module. Instantiated once per session so the slow load
 * can be warmed ahead of the first meeting join instead of on the join path.
 */
export default class WasmLoader {
  private readonly wasmUrl: string;

  private readonly importModule: ModuleImporter;

  private moduleInstance: WebE2EEModule | null = null;

  private moduleLoadPromise: Promise<WebE2EEModule> | null = null;

  /**
   * @param {Object} [options]
   * @param {string} [options.wasmUrl] - URL of the wasm binary; the js loader is derived from it.
   * @param {Function} [options.importModule] - Override the dynamic import (used by tests).
   */
  constructor({wasmUrl, importModule}: {wasmUrl?: string; importModule?: ModuleImporter} = {}) {
    this.wasmUrl = wasmUrl || DEFAULT_WASM_URL;
    this.importModule = importModule || defaultImporter;
  }

  /**
   * @returns {boolean} whether the module has finished loading and is cached.
   */
  isLoaded(): boolean {
    return this.moduleInstance !== null;
  }

  /**
   * Warms the module cache. Safe to call repeatedly; concurrent calls share a single load.
   * @returns {Promise<void>}
   */
  async preload(): Promise<void> {
    await this.get();
  }

  /**
   * Returns the cached module, loading it if necessary.
   * @returns {Promise<WebE2EEModule>}
   */
  get(): Promise<WebE2EEModule> {
    if (this.moduleInstance) {
      return Promise.resolve(this.moduleInstance);
    }
    if (!this.moduleLoadPromise) {
      this.moduleLoadPromise = this.load();
    }

    return this.moduleLoadPromise;
  }

  /**
   * @returns {Promise<WebE2EEModule>}
   */
  private async load(): Promise<WebE2EEModule> {
    const {wasmUrl} = this;
    const jsPath = wasmUrl.replace('.wasm', '.js');

    try {
      const {default: factory} = await this.importModule(jsPath);
      const module = await factory({
        locateFile: (path: string) => (path.endsWith('.wasm') ? wasmUrl : path),
      });

      this.moduleInstance = module;

      return module;
    } catch (error) {
      // Reset so a failed load can be retried on the next get().
      this.moduleLoadPromise = null;
      LoggerProxy.logger.error(`WasmLoader#load --> failed to load WASM module: ${error}`);

      throw new Error(`Failed to load e2ee WASM module: ${error}`);
    }
  }
}
