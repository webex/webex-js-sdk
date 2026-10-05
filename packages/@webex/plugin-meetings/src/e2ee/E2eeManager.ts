/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import LoggerProxy from '../common/logs/logger-proxy';
import WasmLoader from '../common/wasm-loader';
import E2eeIdentityProvider from './E2eeIdentityProvider';
import E2eeMeeting from './E2eeMeeting';
import {E2EE_WASM_URL} from './constants';

/**
 * Meetings-plugin-level singleton that owns the shared, session-scoped E2EE resources (the
 * identity provider), warms the E2EE WASM during registration so per-meeting init stays off the
 * join path, and acts as the factory for per-meeting {@link E2eeMeeting} facades. The WASM loader
 * is owned by `Meetings` (it is not E2EE-specific) and injected here.
 */
export default class E2eeManager {
  private readonly webex: any;

  private readonly wasmLoader: WasmLoader;

  private readonly identityProvider: E2eeIdentityProvider;

  /**
   * @param {Object} deps
   * @param {Object} deps.webex - The parent webex instance.
   * @param {WasmLoader} deps.wasmLoader - Shared WASM loader, owned by Meetings.
   */
  constructor({webex, wasmLoader}: {webex: any; wasmLoader: WasmLoader}) {
    this.webex = webex;
    this.wasmLoader = wasmLoader;
    this.identityProvider = new E2eeIdentityProvider({
      webexRequest: webex.request.bind(webex),
    });
  }

  /**
   * @returns {boolean} whether E2EE is enabled via config.
   */
  get isEnabled(): boolean {
    return !!this.webex?.config?.meetings?.enableE2ee;
  }

  /**
   * Warms the shared E2EE resources (WASM module) when enabled. No-op when disabled. Rejection is
   * handled by the caller (register wires this fire-and-forget so it can never fail registration).
   * @returns {Promise<void>}
   */
  async preload(): Promise<void> {
    if (!this.isEnabled) {
      LoggerProxy.logger.info('e2ee: E2eeManager#preload --> E2EE disabled, skipping WASM preload');

      return;
    }

    LoggerProxy.logger.info('e2ee: E2eeManager#preload --> preloading WASM module');
    await this.wasmLoader.preload(E2EE_WASM_URL);
    LoggerProxy.logger.info('e2ee: E2eeManager#preload --> WASM module preloaded');
  }

  /**
   * Creates the per-meeting E2EE facade, injecting the shared loader, identity provider and config.
   * The returned facade's start() is a no-op unless the meeting requires E2EE and E2EE is enabled.
   * @param {Object} meeting - The owning meeting.
   * @returns {E2eeMeeting}
   */
  createE2eeMeeting(meeting: any): E2eeMeeting {
    LoggerProxy.logger.info('e2ee: E2eeManager#createE2eeMeeting --> creating E2EE meeting facade');

    return new E2eeMeeting({
      meeting,
      webex: this.webex,
      wasmLoader: this.wasmLoader,
      identityProvider: this.identityProvider,
      config: this.webex.config.meetings,
    });
  }
}
