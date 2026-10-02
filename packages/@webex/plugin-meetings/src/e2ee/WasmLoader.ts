/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import LoggerProxy from '../common/logs/logger-proxy';
import type {ModuleFactory, ModuleInstance} from './wasm';

const DEFAULT_WASM_URL = '/wasm/e2ee.wasm';

type ModuleImporter = (jsPath: string) => Promise<{default: ModuleFactory}>;

/**
 * Performs a genuine, un-bundled ES dynamic import of the emscripten loader at runtime.
 *
 * A plain `import(jsPath)` cannot be used here: plugin-meetings ships pre-compiled to CommonJS, and
 * Babel rewrites `import()` into a webpack `require()`, which then tries (and fails) to bundle the
 * runtime-served `/wasm/e2ee.js`. Instead we inject a `type="module"` <script> loaded from a Blob
 * URL (permitted by the app's `script-src blob:` CSP) whose body statically imports the target and
 * hands its namespace back via a one-shot global callback. The `import` lives inside a string, so
 * neither Babel nor webpack ever transforms or statically analyses it.
 * @param {string} jsPath - URL of the emscripten loader module (e.g. '/wasm/e2ee.js').
 * @returns {Promise<{default: ModuleFactory}>}
 */
function importModuleViaScriptTag(jsPath: string): Promise<{default: ModuleFactory}> {
  return new Promise((resolve, reject) => {
    const callbackKey = `__webexE2eeModule_${Math.random().toString(36).slice(2)}`;
    // The blob module's base URL is the (non-hierarchical) blob: scheme, so the import specifier
    // must be an absolute URL — a root-relative path like '/wasm/e2ee.js' cannot be resolved.
    const absoluteJsUrl = new URL(jsPath, window.location.href).href;
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

    (window as any)[callbackKey] = (module: {default: ModuleFactory}) => {
      cleanup();
      resolve(module);
    };

    script.type = 'module';
    script.src = blobUrl;
    script.onerror = () => {
      cleanup();
      reject(new Error(`Failed to import module: ${jsPath}`));
    };

    document.head.appendChild(script);
  });
}

const defaultImporter: ModuleImporter = importModuleViaScriptTag;

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
      LoggerProxy.logger.error(`e2ee: WasmLoader#load --> failed to load WASM module: ${error}`);

      throw new Error(`Failed to load e2ee WASM module: ${error}`);
    }
  }
}
