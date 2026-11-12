/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import LoggerProxy from './logs/logger-proxy';

/**
 * An emscripten MODULARIZE factory — the default export of a generated `*.js` WASM loader. Calling
 * it instantiates the module; `locateFile` lets us point the loader at the `.wasm` binary URL.
 */
export type EmscriptenModuleFactory<TModule = unknown> = (moduleOverrides?: {
  locateFile?: (path: string) => string;
}) => Promise<TModule>;

type ModuleImporter = (jsUrl: string) => Promise<{default: EmscriptenModuleFactory}>;

/**
 * Natively imports an emscripten loader served at runtime.
 *
 * This must stay a real `import()`: babel.config.js excludes `transform-dynamic-import` for this
 * file so Babel doesn't rewrite it to `require()`, and `webpackIgnore` stops consumers' webpack
 * from trying to bundle it. The URL is resolved against the document because a native `import()`
 * would otherwise resolve relative paths against the SDK bundle's URL.
 * @param {string} jsUrl - URL of the emscripten loader module (e.g. '/assets/plugin-meetings/e2ee.js').
 * @returns {Promise<{default: EmscriptenModuleFactory}>}
 */
const nativeImport: ModuleImporter = (jsUrl) =>
  import(/* webpackIgnore: true */ new URL(jsUrl, document.baseURI).href);

interface CachedModule {
  instance: unknown | null;
  loadPromise: Promise<unknown> | null;
}

/**
 * Loads and caches emscripten WebAssembly modules, each uniquely identified by its `.wasm` URL
 * (the `.js` loader URL is derived by replacing the `.wasm` suffix). A single instance can load
 * multiple distinct modules; each URL is loaded at most once and cached. Instantiated once per
 * session so slow loads can be warmed ahead of when they're needed.
 */
export default class WasmLoader {
  private readonly importModule: ModuleImporter;

  private readonly modules = new Map<string, CachedModule>();

  /**
   * @param {Object} [options]
   * @param {Function} [options.importModule] - Override the dynamic import (used by tests).
   */
  constructor({importModule}: {importModule?: ModuleImporter} = {}) {
    this.importModule = importModule || nativeImport;
  }

  /**
   * @param {string} wasmUrl
   * @returns {boolean} whether the module for the given URL has finished loading and is cached.
   */
  isLoaded(wasmUrl: string): boolean {
    const cached = this.modules.get(wasmUrl);

    return !!cached && cached.instance !== null;
  }

  /**
   * Warms the cache for the given module URL. Safe to call repeatedly; concurrent calls share a
   * single load.
   * @param {string} wasmUrl
   * @returns {Promise<void>}
   */
  async preload(wasmUrl: string): Promise<void> {
    await this.get(wasmUrl);
  }

  /**
   * Returns the cached module for the given URL, loading it if necessary.
   * @param {string} wasmUrl
   * @returns {Promise<TModule>}
   */
  get<TModule = unknown>(wasmUrl: string): Promise<TModule> {
    let cached = this.modules.get(wasmUrl);

    if (!cached) {
      cached = {instance: null, loadPromise: null};
      this.modules.set(wasmUrl, cached);
    }

    if (cached.instance !== null) {
      return Promise.resolve(cached.instance as TModule);
    }
    if (!cached.loadPromise) {
      cached.loadPromise = this.load(wasmUrl, cached);
    }

    return cached.loadPromise as Promise<TModule>;
  }

  /**
   * @param {string} wasmUrl
   * @param {CachedModule} cached
   * @returns {Promise<unknown>}
   */
  private async load(wasmUrl: string, cached: CachedModule): Promise<unknown> {
    const jsUrl = wasmUrl.replace(/\.wasm(?=[?#]|$)/, '.js');

    try {
      const {default: factory} = await this.importModule(jsUrl);
      const instance = await factory({
        locateFile: (path: string) => (path.endsWith('.wasm') ? wasmUrl : path),
      });

      cached.instance = instance;

      return instance;
    } catch (error) {
      // Reset so a failed load can be retried on the next get().
      cached.loadPromise = null;
      LoggerProxy.logger.error(
        `WasmLoader#load --> failed to load WASM module ${wasmUrl}: ${error}`
      );

      throw new Error(`Failed to load WASM module ${wasmUrl}: ${error}`, {cause: error});
    }
  }
}
