/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import WasmLoader from './WasmLoader';

export interface E2eeManagerConfig {
  enableE2ee?: boolean;
}

/**
 * Meetings-plugin-level singleton that owns the shared, session-scoped E2EE resources (currently
 * the WASM loader) and warms them during registration so per-meeting init stays off the join path.
 */
export default class E2eeManager {
  private readonly config: E2eeManagerConfig;

  private readonly wasmLoader: WasmLoader;

  /**
   * @param {Object} deps
   * @param {E2eeManagerConfig} deps.config - The meetings plugin config (read lazily).
   */
  constructor({config}: {config: E2eeManagerConfig}) {
    this.config = config ?? {};
    this.wasmLoader = new WasmLoader();
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
}
