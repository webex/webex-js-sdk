/* eslint-disable require-jsdoc */
/*!
 * Copyright (c) 2015-2024 Cisco Systems, Inc. See LICENSE file.
 */

// @ts-ignore
import {WebexPlugin} from '@webex/webex-core';
// @ts-ignore
import config from './config';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Mercury = require('./mercury');

/**
 * MercuryPlugin is the plugin registered as `this.webex.internal.mercury`.
 *
 * It wraps a single {@link Mercury} instance and delegates all public methods
 * and property reads to it, while transparently proxying all events so that
 * existing consumers — which subscribe via `this.webex.internal.mercury.on(...)` —
 * continue to work without any changes.
 *
 * The wrapped Mercury instance handles session-multiplexed connections
 * (including the session-suffix event convention used by multi-connection
 * scenarios), keepalive backoff, and all low-level WebSocket management.
 */
export class MercuryPlugin extends (WebexPlugin as any) {
  namespace = 'Mercury';

  /** The wrapped Mercury connection manager. */
  private _mercury: any;

  initialize(...args: any[]) {
    super.initialize?.(...args);

    this._mercury = new (Mercury as any)({parent: (this as any).webex});

    // Re-emit every event from Mercury on this plugin so listeners attached to
    // `this.webex.internal.mercury` continue to work.
    this._mercury.on('all', (eventName: string, ...rest: any[]) => {
      (this as any).trigger(eventName, ...rest);
    });
  }

  /** True when the primary Mercury socket is connected. */
  get connected(): boolean {
    return this._mercury?.connected ?? false;
  }

  /** The primary socket, if connected. */
  get socket(): any {
    return this._mercury?.socket;
  }

  connect(webSocketUrl?: string): Promise<void> {
    return this._mercury.connect(webSocketUrl);
  }

  disconnect(options?: any): Promise<void> {
    return this._mercury.disconnect(options);
  }

  disconnectAll(options?: any): Promise<void> {
    return this._mercury.disconnectAll(options);
  }

  logout(): Promise<void> {
    return this._mercury.logout();
  }

  processRegistrationStatusEvent(message: any): void {
    return this._mercury.processRegistrationStatusEvent(message);
  }
}

export {config};
export default MercuryPlugin;
