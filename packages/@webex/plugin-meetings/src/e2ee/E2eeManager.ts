/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

import {CapabilityState, WebCapabilities} from '@webex/web-capabilities';
// @ts-ignore - StaticAssetLoader is exported from webex-core's JavaScript entry point.
import {StaticAssetLoader} from '@webex/webex-core';

import LoggerProxy from '../common/logs/logger-proxy';
import WasmLoader from '../common/wasm-loader';

const E2EE_WASM_ASSET = 'e2ee.wasm';

/**
 * Owns E2EE resource preloading for a Meetings plugin session. The per-meeting controller is added
 * in the follow-up integration change; this first step keeps the slow WASM load off the join path.
 */
export default class E2eeManager {
  private readonly webex: any;

  private readonly wasmLoader: WasmLoader;

  private readonly assetLoader: StaticAssetLoader;

  constructor({webex, wasmLoader}: {webex: any; wasmLoader: WasmLoader}) {
    this.webex = webex;
    this.wasmLoader = wasmLoader;
    this.assetLoader = new StaticAssetLoader(
      {baseUrl: webex.config?.meetings?.assetsBaseUrl ?? '/assets/plugin-meetings/'},
      {parent: webex}
    );
  }

  /**
   * Warms the E2EE WASM module when configured and supported. Callers should not await this from
   * registration; a loading failure must not prevent the client from registering for meetings.
   * @returns {Promise<void>}
   */
  async preload(): Promise<void> {
    const enabled = !!this.webex?.config?.meetings?.enableE2ee;
    const supported = WebCapabilities.supportsWasm() === CapabilityState.CAPABLE;

    if (!enabled || !supported) {
      LoggerProxy.logger.info('e2ee: E2eeManager#preload --> E2EE disabled or unsupported');

      return;
    }

    const wasmUrl = this.assetLoader.getUrl(E2EE_WASM_ASSET);

    LoggerProxy.logger.info('e2ee: E2eeManager#preload --> preloading WASM module');
    await this.wasmLoader.preload(wasmUrl);
    LoggerProxy.logger.info('e2ee: E2eeManager#preload --> WASM module preloaded');
  }
}
