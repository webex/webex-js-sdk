/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import LoggerProxy from '../common/logs/logger-proxy';
import WasmLoader from '../common/wasm-loader';
import E2eeController from './E2eeController';
import MeetingsUtil from '../meetings/util';
import type {E2eeMeetingContext} from './types';

/**
 * Owns E2EE resource preloading for a Meetings plugin session and creates its per-meeting
 * controllers. Meetings supplies the shared WASM loader and resolved module URL.
 */
export default class E2eeManager {
  private readonly webex: any;

  private readonly wasmLoader: WasmLoader;

  private readonly wasmUrl: string;

  /**
   * @param {Object} deps
   * @param {Object} deps.webex - The parent webex instance.
   * @param {WasmLoader} deps.wasmLoader - Shared WASM loader, owned by Meetings.
   * @param {string} deps.wasmUrl - URL of the E2EE WASM module, resolved by Meetings.
   */
  constructor({webex, wasmLoader, wasmUrl}: {webex: any; wasmLoader: WasmLoader; wasmUrl: string}) {
    this.webex = webex;
    this.wasmLoader = wasmLoader;
    this.wasmUrl = wasmUrl;
  }

  /**
   * @returns {boolean} whether E2EE is enabled via config.
   */
  get isEnabled(): boolean {
    return MeetingsUtil.isE2eeEnabledAndSupported(this.webex?.config);
  }

  /**
   * Warms the shared E2EE resources (WASM module) when enabled. No-op when disabled. Rejection is
   * handled by the caller (register wires this fire-and-forget so it can never fail registration).
   * @returns {Promise<void>}
   */
  async preload(): Promise<void> {
    if (!this.isEnabled) {
      LoggerProxy.logger.info(
        'e2ee: E2eeManager#preload --> E2EE disabled or not supported, skipping WASM preload'
      );

      return;
    }

    LoggerProxy.logger.info('e2ee: E2eeManager#preload --> preloading WASM module');
    await this.wasmLoader.preload(this.wasmUrl);
    LoggerProxy.logger.info('e2ee: E2eeManager#preload --> WASM module preloaded');
  }

  /**
   * Creates the per-meeting E2EE controller, injecting the shared loader, module URL, identity provider and config.
   * The returned facade's start() is a no-op unless the meeting requires E2EE and E2EE is enabled.
   * @param {E2eeMeetingContext} context - The meeting data and operations used by E2EE.
   * @returns {E2eeController}
   */
  createE2eeController(context: E2eeMeetingContext): E2eeController {
    LoggerProxy.logger.info(
      'e2ee: E2eeManager#createE2eeController --> creating E2EE meeting facade'
    );

    return new E2eeController({
      context,
      webex: this.webex,
      wasmLoader: this.wasmLoader,
      wasmUrl: this.wasmUrl,
      identityProvider: this.webex.internal.identity,
    });
  }
}
