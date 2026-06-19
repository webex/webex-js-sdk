/* eslint-disable require-jsdoc */
/*!
 * Copyright (c) 2015-2024 Cisco Systems, Inc. See LICENSE file.
 */

// @ts-ignore
import {WebexPlugin} from '@webex/webex-core';

import config from './config';

// Since mercury-plugin.ts is a .ts file, the TS language server tries to parse mercury.js and chokes on the @deprecated decorator.
// using a require() call instead of import to avoid TS parsing the file:

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Mercury = require('./mercury').default;

export class MercuryPlugin extends (WebexPlugin as any) {
  namespace = 'Mercury';

  private _mercury: any;

  constructor(...args: any[]) {
    super(...args);
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

  getLastError(): any {
    return this._mercury?.getLastError();
  }

  get hasEverConnected(): boolean {
    return this._mercury?.hasEverConnected ?? false;
  }

  connect(webSocketUrl?: string): Promise<void> {
    return this._mercury.connect(webSocketUrl);
  }

  disconnect(options?: any): Promise<void> {
    return this._mercury.disconnect(options);
  }

  logout(): Promise<void> {
    const normalReconnectReasons = ['idle', 'done (forced)', 'pong not received', 'pong mismatch'];
    const reason = this.config.beforeLogoutOptionsCloseReason;
    const options =
      reason && !normalReconnectReasons.includes(reason) ? {code: 3050, reason} : undefined;

    return this._mercury.disconnect(options);
  }

  processRegistrationStatusEvent(message: any): void {
    return this._mercury.processRegistrationStatusEvent(message);
  }
}

export {config};
export default MercuryPlugin;
