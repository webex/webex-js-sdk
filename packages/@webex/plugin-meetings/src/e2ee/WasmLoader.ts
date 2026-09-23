/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import LoggerProxy from '../common/logs/logger-proxy';
import type {ModuleFactory, ModuleInstance} from './wasm';

const DEFAULT_WASM_URL = '/wasm/e2ee.wasm';

type ModuleImporter = (jsPath: string) => Promise<{default: ModuleFactory}>;

const defaultImporter: ModuleImporter = (jsPath) => import(/* webpackIgnore: true */ jsPath);

/** The subset of WasmLoader consumed by the MLS engine, so it can be injected/faked in tests. */
export interface IWasmLoader {
  preload(): Promise<void>;
  get(): Promise<ModuleInstance>;
  isLoaded(): boolean;
}

/**
 * Loads and caches the e2ee WebAssembly module. Instantiated once per session so the slow load
 * can be warmed ahead of the first meeting join instead of on the join path.
 */
export default class WasmLoader implements IWasmLoader {
  private readonly wasmUrl: string;

  private readonly importModule: ModuleImporter;

  private moduleInstance: ModuleInstance | null = null;

  private moduleLoadPromise: Promise<ModuleInstance> | null = null;

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
   * @returns {Promise<ModuleInstance>}
   */
  get(): Promise<ModuleInstance> {
    if (this.moduleInstance) {
      return Promise.resolve(this.moduleInstance);
    }
    if (!this.moduleLoadPromise) {
      this.moduleLoadPromise = this.load();
    }

    return this.moduleLoadPromise;
  }

  /**
   * @returns {Promise<ModuleInstance>}
   */
  private async load(): Promise<ModuleInstance> {
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
