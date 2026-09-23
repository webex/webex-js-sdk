/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import WasmLoader from './WasmLoader';
import E2eeIdentityProvider from './E2eeIdentityProvider';
import E2eeMeeting from './E2eeMeeting';
import type {E2eeConfig} from './types';

/**
 * Meetings-plugin-level singleton that owns the shared, session-scoped E2EE resources (the WASM
 * loader and the identity provider), warms the WASM during registration so per-meeting init stays
 * off the join path, and acts as the factory for per-meeting {@link E2eeMeeting} facades.
 */
export default class E2eeManager {
  private readonly webex: any;

  private readonly config: E2eeConfig;

  private readonly wasmLoader: WasmLoader;

  private readonly identityProvider: E2eeIdentityProvider;

  /**
   * @param {Object} deps
   * @param {Object} deps.webex - The parent webex instance.
   * @param {E2eeConfig} deps.config - The meetings plugin config (read lazily).
   */
  constructor({webex, config}: {webex: any; config: E2eeConfig}) {
    this.webex = webex;
    this.config = config ?? {};
    this.wasmLoader = new WasmLoader();
    this.identityProvider = new E2eeIdentityProvider({webex});
  }

  /**
   * @returns {boolean} whether E2EE is enabled via config.
   */
  get isEnabled(): boolean {
    return !!this.config.enableE2ee;
  }

  /**
   * Warms the shared E2EE resources (WASM module) when enabled. No-op when disabled. Rejection is
   * handled by the caller (register wires this fire-and-forget so it can never fail registration).
   * @returns {Promise<void>}
   */
  async preload(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    await this.wasmLoader.preload();
  }

  /**
   * Creates the per-meeting E2EE facade, injecting the shared loader, identity provider and config.
   * The returned facade's start() is a no-op unless the meeting requires E2EE and E2EE is enabled.
   * @param {Object} meeting - The owning meeting.
   * @returns {E2eeMeeting}
   */
  createE2eeMeeting(meeting: any): E2eeMeeting {
    return new E2eeMeeting({
      meeting,
      webex: this.webex,
      wasmLoader: this.wasmLoader,
      identityProvider: this.identityProvider,
      config: this.config,
    });
  }
}
