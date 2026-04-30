/* eslint-disable no-restricted-globals */

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-env browser */

import Socket from './socket-base';
import type {BrowserWebSocketConstructor, ShimGlobalScope} from './types';

Socket.getWebSocketConstructor = function getWebSocketConstructor() {
  if (typeof WebSocket !== 'undefined') {
    return WebSocket;
  }

  const scope = typeof globalThis !== 'undefined' ? (globalThis as ShimGlobalScope) : undefined;

  return (scope?.WebSocket || scope?.MozWebSocket) as BrowserWebSocketConstructor;
};

export default Socket;
