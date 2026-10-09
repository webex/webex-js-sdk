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
 * Performs a genuine, un-bundled ES dynamic import of an emscripten loader at runtime.
 *
 * A plain `import(jsUrl)` cannot be used here: plugin-meetings ships pre-compiled to CommonJS, and
 * Babel rewrites `import()` into a webpack `require()`, which then tries (and fails) to bundle the
 * runtime-served loader. Instead we inject a `type="module"` <script> loaded from a Blob URL
 * (permitted by the app's `script-src blob:` CSP) whose body statically imports the target and
 * hands its namespace back via a one-shot global callback. The `import` lives inside a string, so
 * neither Babel nor webpack ever transforms or statically analyses it.
 * @param {string} jsUrl - URL of the emscripten loader module (e.g. '/wasm/e2ee.js').
 * @returns {Promise<{default: EmscriptenModuleFactory}>}
 */
function importModuleViaScriptTag(jsUrl: string): Promise<{default: EmscriptenModuleFactory}> {
  return new Promise((resolve, reject) => {
    const callbackKey = `__webexWasmModule_${Math.random().toString(36).slice(2)}`;
    // The blob module's base URL is the (non-hierarchical) blob: scheme, so the import specifier
    // must be an absolute URL — a root-relative path like '/wasm/e2ee.js' cannot be resolved.
    const absoluteJsUrl = new URL(jsUrl, window.location.href).href;
    const blobUrl = URL.createObjectURL(
      new Blob(
        [
          `import * as module from ${JSON.stringify(absoluteJsUrl)};\nwindow[${JSON.stringify(
            callbackKey
          )}](module);`,
        ],
        {type: 'text/javascript'}
      )
    );
    const script = document.createElement('script');

    const cleanup = () => {
      delete (window as any)[callbackKey];
      URL.revokeObjectURL(blobUrl);
      script.remove();
    };

    (window as any)[callbackKey] = (module: {default: EmscriptenModuleFactory}) => {
      cleanup();
      resolve(module);
    };

    script.type = 'module';
    script.src = blobUrl;
    script.onerror = () => {
      cleanup();
      reject(new Error(`Failed to import module: ${jsUrl}`));
    };

    document.head.appendChild(script);
  });
}

const defaultImporter: ModuleImporter = importModuleViaScriptTag;

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
    this.importModule = importModule || defaultImporter;
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

    if (cached.instance) {
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
    const jsUrl = wasmUrl.replace('.wasm', '.js');

    try {
      const {default: factory} = await this.importModule(jsUrl);
      const module = await factory({
        locateFile: (path: string) => (path.endsWith('.wasm') ? wasmUrl : path),
      });

      cached.instance = module;

      return module;
    } catch (error) {
      // Reset so a failed load can be retried on the next get().
      cached.loadPromise = null;
      LoggerProxy.logger.error(
        `WasmLoader#load --> failed to load WASM module ${wasmUrl}: ${error}`
      );

      throw new Error(`Failed to load WASM module ${wasmUrl}: ${error}`);
    }
  }
}
